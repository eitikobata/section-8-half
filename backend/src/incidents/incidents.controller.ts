import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IncidentsService } from './incidents.service';
import { ListIncidentsDto } from './dto/list-incidents.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { RegisterDecisionDto } from './dto/register-decision.dto';

interface AuthenticatedRequest extends Request {
  user: { id: string; username: string; role: string };
}

// Every route here requires a valid access token (Bloco 4.5) — incidents
// are analyst-facing data, there's no anonymous read access.
@UseGuards(JwtAuthGuard)
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  // Historical view — the live feed comes over the socket, this is for
  // "what happened before I opened the dashboard" / filtering by status.
  @Get()
  list(@Query() query: ListIncidentsDto) {
    return this.incidentsService.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.incidentsService.findOne(id);
  }

  @Patch(':id/investigate')
  investigate(@Param('id') id: string) {
    return this.incidentsService.changeStatus(id, 'INVESTIGATING');
  }

  @Patch(':id/close')
  close(@Param('id') id: string) {
    return this.incidentsService.changeStatus(id, 'CLOSED');
  }

  @Patch(':id/escalate')
  escalate(@Param('id') id: string) {
    return this.incidentsService.changeStatus(id, 'ESCALATED');
  }

  @Post(':id/comments')
  comment(
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.incidentsService.addComment(id, dto, req.user.id);
  }

  @Post(':id/decision')
  decision(@Param('id') id: string, @Body() dto: RegisterDecisionDto) {
    return this.incidentsService.registerAnalystDecision(id, dto);
  }
}
