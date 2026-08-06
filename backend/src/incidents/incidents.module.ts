import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { IncidentsGateway } from './incidents.gateway';

@Module({
  imports: [PrismaModule],
  controllers: [IncidentsController],
  providers: [IncidentsService, IncidentsGateway],
  // Exported so CorrelationModule can inject the gateway directly and
  // emit "incident.created"/"incident.updated" the moment the engine
  // changes something, without round-tripping through HTTP.
  exports: [IncidentsGateway],
})
export class IncidentsModule {}
