import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Ingestion pipeline for a single raw event:
   * 1. Upsert the entity (sensors don't pre-register entities, they just
   *    start reporting on them — first event creates the record)
   * 2. Persist the raw event (audit trail, source of truth)
   * 3. Publish to the Redis Stream (fan-out to the correlation worker,
   *    built in Bloco 2)
   *
   * Order matters: we persist to Postgres BEFORE publishing to the stream,
   * so the rawEventId we hand to the worker always resolves to a real row.
   */
  async ingest(dto: CreateEventDto) {
    const entity = await this.prisma.entity.upsert({
      where: { externalId: dto.entityId },
      update: { location: dto.location ?? undefined },
      create: {
        externalId: dto.entityId,
        location: dto.location,
      },
    });

    const rawEvent = await this.prisma.rawEvent.create({
      data: {
        entityId: entity.id,
        eventType: dto.eventType,
        location: dto.location,
        severityRaw: dto.severityRaw,
        occurredAt: new Date(dto.timestamp),
        metadata: dto.metadata ? (dto.metadata as any) : undefined,
      },
    });

    await this.redis.publishEvent({
      rawEventId: rawEvent.id,
      entityExternalId: entity.externalId,
      eventType: dto.eventType,
      location: dto.location,
      severityRaw: dto.severityRaw,
      occurredAt: dto.timestamp,
      metadata: dto.metadata,
    });

    this.logger.log(
      `Ingested event ${rawEvent.id} for entity ${entity.externalId} (${dto.eventType})`,
    );

    return rawEvent;
  }
}
