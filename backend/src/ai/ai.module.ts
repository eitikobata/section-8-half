import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { AiService } from './ai.service';

@Module({
  imports: [PrismaModule, IncidentsModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
