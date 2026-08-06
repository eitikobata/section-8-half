import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * Real-time layer (Bloco 3).
 *
 * Single global namespace, broadcast to every connected client — there's
 * no per-analyst auth/session model yet, so room-scoping isn't worth the
 * complexity at this stage. Whoever's watching the dashboard sees
 * everything, same as the live feed in the real tools this replicates.
 *
 * The gateway itself has no business logic: it's a thin emit surface
 * that CorrelationService and IncidentsService push into after they've
 * already changed the source of truth (Postgres). Socket events are a
 * notification channel, not a state store.
 */
@WebSocketGateway({
  cors: { origin: '*' },
})
export class IncidentsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(IncidentsGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /** A brand-new Incident was created by the correlation engine. */
  emitIncidentCreated(incident: unknown) {
    this.server.emit('incident.created', incident);
  }

  /**
   * An existing Incident changed — status transition, severity bump from
   * being fed more events, etc. `patch` carries just what changed plus
   * the id, not the full row, so the front can merge it into local state
   * without a refetch.
   */
  emitIncidentUpdated(patch: { id: string } & Record<string, unknown>) {
    this.server.emit('incident.updated', patch);
  }

  /** An analyst commented on an incident. */
  emitIncidentComment(comment: unknown) {
    this.server.emit('incident.comment', comment);
  }
}
