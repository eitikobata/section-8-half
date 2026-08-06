import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import Redis from 'ioredis';
import { redisConfig } from '../config/redis.config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  onModuleInit() {
    this.client = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
    });

    this.client.on('connect', () =>
      this.logger.log('Connected to Redis'),
    );
    this.client.on('error', (err) =>
      this.logger.error(`Redis connection error: ${err.message}`),
    );
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  /**
   * Publishes a raw event to the Redis Stream.
   * Uses XADD with '*' so Redis auto-generates the entry ID.
   *
   * Payload fields are flattened into a field/value list because
   * Streams don't store nested objects — this is why we JSON.stringify
   * the metadata blob separately.
   *
   * The worker in Bloco 2 will XREAD/XREADGROUP off this same stream key.
   */
  async publishEvent(payload: {
    rawEventId: string;
    entityExternalId: string;
    eventType: string;
    location?: string;
    severityRaw: number;
    occurredAt: string;
    metadata?: Record<string, unknown>;
  }): Promise<string | null> {
    const entryId = await this.client.xadd(
      redisConfig.streamKey,
      '*',
      'rawEventId',
      payload.rawEventId,
      'entityExternalId',
      payload.entityExternalId,
      'eventType',
      payload.eventType,
      'location',
      payload.location ?? '',
      'severityRaw',
      String(payload.severityRaw),
      'occurredAt',
      payload.occurredAt,
      'metadata',
      JSON.stringify(payload.metadata ?? {}),
    );

    this.logger.debug(
      `Published event ${payload.rawEventId} to stream as ${entryId}`,
    );

    return entryId;
  }

  getClient(): Redis {
    return this.client;
  }
}
