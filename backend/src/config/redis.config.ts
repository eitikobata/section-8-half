// Centralized Redis config so both the RedisService and any future
// worker (Bloco 2) read the same stream key from the same place.
export const redisConfig = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  streamKey: process.env.REDIS_STREAM_KEY ?? 'events:stream',
};
