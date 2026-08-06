import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { CorrelationService } from './correlation.service';

@Module({
  imports: [PrismaModule, RedisModule, IncidentsModule],
  providers: [CorrelationService],
})
export class CorrelationModule {}
