import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // Entry point for all "sensors" (simulated androids/cameras/cyberbrains).
  // Kept intentionally dumb: validate, persist, publish. All the
  // interesting logic (correlation) lives downstream in the worker.
  @Post()
  @HttpCode(202)
  async receive(@Body() dto: CreateEventDto) {
    const event = await this.eventsService.ingest(dto);
    return {
      accepted: true,
      rawEventId: event.id,
    };
  }
}
