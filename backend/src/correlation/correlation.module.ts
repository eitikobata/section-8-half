import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { CorrelationService } from './correlation.service';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [CorrelationService],
})
export class CorrelationModule {}
