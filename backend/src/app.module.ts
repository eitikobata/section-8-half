import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { EventsModule } from './events/events.module';
import { CorrelationModule } from './correlation/correlation.module';
import { IncidentsModule } from './incidents/incidents.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    RedisModule,
    EventsModule,
    CorrelationModule,
    IncidentsModule,
  ],
})
export class AppModule {}
