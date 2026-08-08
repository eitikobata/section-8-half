import { Controller, Get } from '@nestjs/common';

// Plain, dependency-free health check. Deliberately does NOT touch
// Postgres or Redis — this needs to answer fast and reliably even if
// those are momentarily slow, since orchestrators (EasyPanel/Swarm)
// use this to decide whether to kill and replace the container.
@Controller()
export class AppController {
  @Get()
  healthCheck() {
    return { status: 'ok', service: 'section-8-half-backend' };
  }
}
