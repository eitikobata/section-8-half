import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';

/**
 * Real-time layer (Bloco 3), auth-gated since Bloco 4.5.
 *
 * Single global namespace, broadcast to every connected authenticated
 * client — there's still no per-analyst room-scoping (any logged-in
 * analyst sees everything), but the socket now requires a valid access
 * token to connect at all. WsJwtGuard runs in handleConnection by hand
 * (Nest doesn't invoke @UseGuards for the connection lifecycle hook
 * itself, only for @SubscribeMessage handlers), and a failed check
 * disconnects the socket immediately.
 *
 * The gateway itself has no other business logic: it's a thin emit
 * surface that CorrelationService and IncidentsService push into after
 * they've already changed the source of truth (Postgres). Socket events
 * are a notification channel, not a state store.
 */
@WebSocketGateway({
  cors: { origin: '*' },
})
export class IncidentsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(IncidentsGateway.name);

  @WebSocketServer()
  server!: Server; 

  constructor(private readonly wsJwtGuard: WsJwtGuard) {}

  handleConnection(client: Socket) {
    if (!this.wsJwtGuard.verifyClient(client)) {
      client.disconnect(true);
      return;
    }

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

  /**
   * AI analysis complete (Bloco 4) — summary, suggested severity, and agent
   * recommendation are now ready. Or analyst decision registered.
   */
  emitIncidentAnalysis(
    patch: { id: string } & Record<string, unknown>,
  ) {
    this.server.emit('incident.analysis', patch);
  }
}
