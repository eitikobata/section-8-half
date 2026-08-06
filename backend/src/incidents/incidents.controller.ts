import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { ListIncidentsDto } from './dto/list-incidents.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

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
  comment(@Param('id') id: string, @Body() dto: CreateCommentDto) {
    return this.incidentsService.addComment(id, dto);
  }
}
