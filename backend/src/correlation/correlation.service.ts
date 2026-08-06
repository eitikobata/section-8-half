import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { IncidentsGateway } from '../incidents/incidents.gateway';
import { redisConfig } from '../config/redis.config';
import { correlationConfig } from '../config/correlation.config';
import { computeSeverity } from './severity.util';

type StreamEntry = [id: string, fields: string[]];
type StreamReadResult = [streamKey: string, entries: StreamEntry[]][] | null;

/**
 * Correlation engine (Bloco 2).
 *
 * Runs as a background consumer inside the same Nest process (consumer
 * group off `events:stream`), rather than a separate process — there's
 * no scale requirement here, and a consumer group already gives us
 * resumable, at-least-once delivery if this gets split out later.
 *
 * Rule: N events for the same entity, each with severityRaw above a
 * threshold, inside a sliding time window => open (or feed) an Incident.
 *
 * State for "what's inside the current window" lives in Redis (a
 * per-entity sorted set, score = event timestamp). The events themselves
 * stay in Postgres — Redis only tracks membership/ordering, Postgres is
 * still the single source of truth for event data.
 */
@Injectable()
export class CorrelationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CorrelationService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly gateway: IncidentsGateway,
  ) {}

  async onModuleInit() {
    await this.ensureConsumerGroup();
    this.running = true;
    // Fire and forget: the loop lives for the app's lifetime, driven by
    // BLOCK on XREADGROUP rather than a setInterval poll.
    void this.consumeLoop();
  }

  onModuleDestroy() {
    this.running = false;
  }

  private async ensureConsumerGroup() {
    const client = this.redis.getClient();
    try {
      await client.xgroup(
        'CREATE',
        redisConfig.streamKey,
        correlationConfig.consumerGroup,
        '$',
        'MKSTREAM',
      );
      this.logger.log(
        `Created consumer group "${correlationConfig.consumerGroup}" on "${redisConfig.streamKey}"`,
      );
    } catch (err: any) {
      if (String(err?.message).includes('BUSYGROUP')) {
        this.logger.debug(
          `Consumer group "${correlationConfig.consumerGroup}" already exists`,
        );
      } else {
        throw err;
      }
    }
  }

  private async consumeLoop() {
    const client = this.redis.getClient();

    while (this.running) {
      try {
        // ioredis's typed overloads for xreadgroup don't cover every
        // valid argument order (BLOCK before COUNT) — cast at the call
        // boundary, keep everything downstream fully typed via StreamReadResult.
        const result = (await (client as any).xreadgroup(
          'GROUP',
          correlationConfig.consumerGroup,
          correlationConfig.consumerName,
          'BLOCK',
          correlationConfig.blockMs,
          'COUNT',
          correlationConfig.batchCount,
          'STREAMS',
          redisConfig.streamKey,
          '>',
        )) as StreamReadResult;

        if (!result) continue; // BLOCK timed out, nothing new — loop again

        const [, entries] = result[0];
        for (const [entryId, fields] of entries) {
          await this.handleEntry(entryId, fields);
        }
      } catch (err: any) {
        this.logger.error(`Consume loop error: ${err.message}`);
        await this.sleep(1000); // brief backoff before retrying
      }
    }
  }

  private async handleEntry(entryId: string, fields: string[]) {
    const client = this.redis.getClient();

    try {
      const data = this.parseFields(fields);
      const severityRaw = parseInt(data.severityRaw, 10);

      if (severityRaw >= correlationConfig.suspicionThreshold) {
        const windowKey = this.windowKey(data.entityExternalId);
        const occurredAtMs = new Date(data.occurredAt).getTime();

        await client.zadd(windowKey, occurredAtMs, data.rawEventId);
        // Safety-net TTL so a window key never lingers forever for an
        // entity that goes quiet — well past the window itself.
        await client.expire(
          windowKey,
          Math.ceil((correlationConfig.windowMs * 2) / 1000),
        );

        await this.correlateEntity(data.entityExternalId);
      }
    } catch (err: any) {
      this.logger.error(`Failed to process entry ${entryId}: ${err.message}`);
      // No dead-letter queue yet (out of scope for Bloco 2) — we still
      // ack below so one bad entry can't block the stream forever.
    } finally {
      await client.xack(
        redisConfig.streamKey,
        correlationConfig.consumerGroup,
        entryId,
      );
    }
  }

  /**
   * Evaluates the correlation rule for one entity: prune the window,
   * check the threshold, and either open a new Incident or feed an
   * already-open one with the events that aren't linked yet.
   */
  private async correlateEntity(entityExternalId: string) {
    const client = this.redis.getClient();
    const windowKey = this.windowKey(entityExternalId);
    const cutoff = Date.now() - correlationConfig.windowMs;

    await client.zremrangebyscore(windowKey, '-inf', cutoff);
    const count = await client.zcard(windowKey);
    if (count < correlationConfig.eventThreshold) return;

    const rawEventIds = await client.zrange(windowKey, 0, -1);

    const entity = await this.prisma.entity.findUnique({
      where: { externalId: entityExternalId },
    });
    if (!entity) return;

    const windowEvents = await this.prisma.rawEvent.findMany({
      where: { id: { in: rawEventIds } },
    });
    const unlinkedIds = windowEvents
      .filter((e: { incidentId: string | null }) => !e.incidentId)
      .map((e: { id: string }) => e.id);
    const severity = computeSeverity(
      windowEvents,
      correlationConfig.eventThreshold,
    );

    const openIncident = await this.prisma.incident.findFirst({
      where: {
        entityId: entity.id,
        status: { in: ['OPEN', 'INVESTIGATING'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (openIncident) {
      if (unlinkedIds.length > 0) {
        await this.prisma.rawEvent.updateMany({
          where: { id: { in: unlinkedIds } },
          data: { incidentId: openIncident.id },
        });
      }
      const updatedSeverity = Math.max(severity, openIncident.severity ?? 0);
      await this.prisma.incident.update({
        where: { id: openIncident.id },
        data: { severity: updatedSeverity },
      });
      this.logger.log(
        `Fed incident ${openIncident.id} with ${unlinkedIds.length} more event(s) for ${entityExternalId}`,
      );

      // Existing incident got more suspicious activity linked to it —
      // notify the dashboard so severity/badge updates without a refetch.
      this.gateway.emitIncidentUpdated({
        id: openIncident.id,
        severity: updatedSeverity,
        newEventCount: unlinkedIds.length,
      });
    } else {
      const incident = await this.prisma.incident.create({
        data: {
          entityId: entity.id,
          status: 'OPEN',
          severity,
          events: { connect: unlinkedIds.map((id: string) => ({ id })) },
        },
        include: { entity: true },
      });
      this.logger.warn(
        `Incident opened: ${incident.id} for entity ${entityExternalId} (severity ${severity}, ${unlinkedIds.length} events)`,
      );

      this.gateway.emitIncidentCreated(incident);
    }
  }

  private windowKey(entityExternalId: string) {
    return `correlation:entity:${entityExternalId}`;
  }

  private parseFields(fields: string[]): Record<string, string> {
    const obj: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      obj[fields[i]] = fields[i + 1];
    }
    return obj;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
