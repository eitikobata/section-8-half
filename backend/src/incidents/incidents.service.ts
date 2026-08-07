import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IncidentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IncidentsGateway } from './incidents.gateway';
import { ListIncidentsDto } from './dto/list-incidents.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { RegisterDecisionDto } from './dto/register-decision.dto';

// Which status transitions an analyst action is allowed to make.
// CLOSED is terminal — reopening isn't a Bloco 3 concern.
const ALLOWED_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  OPEN: ['INVESTIGATING', 'ESCALATED', 'CLOSED'],
  INVESTIGATING: ['ESCALATED', 'CLOSED'],
  ESCALATED: ['CLOSED'],
  CLOSED: [],
};

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: IncidentsGateway,
  ) {}

  /** Historical listing, not just the live feed — supports the dashboard's "past incidents" view. */
  async list(query: ListIncidentsDto) {
    const where = query.status ? { status: query.status } : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.incident.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
        include: { entity: true },
      }),
      this.prisma.incident.count({ where }),
    ]);

    return { items, total, limit: query.limit, offset: query.offset };
  }

  async findOne(id: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: {
        entity: true,
        events: { orderBy: { occurredAt: 'asc' } },
        comments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!incident) throw new NotFoundException(`Incident ${id} not found`);
    return incident;
  }

  async changeStatus(id: string, target: IncidentStatus) {
    const incident = await this.getOrThrow(id);
    const allowed = ALLOWED_TRANSITIONS[incident.status];

    if (!allowed.includes(target)) {
      throw new BadRequestException(
        `Cannot move incident from ${incident.status} to ${target}`,
      );
    }

    const updated = await this.prisma.incident.update({
      where: { id },
      data: {
        status: target,
        closedAt: target === 'CLOSED' ? new Date() : incident.closedAt,
      },
    });

    this.gateway.emitIncidentUpdated({
      id: updated.id,
      status: updated.status,
      closedAt: updated.closedAt,
    });

    return updated;
  }

  async addComment(id: string, dto: CreateCommentDto, authorId: string) {
    await this.getOrThrow(id);

    const comment = await this.prisma.incidentComment.create({
      data: {
        incidentId: id,
        authorId,
        body: dto.body,
      },
      include: { author: { select: { id: true, username: true } } },
    });

    this.gateway.emitIncidentComment(comment);
    return comment;
  }

  async registerAnalystDecision(
    id: string,
    dto: RegisterDecisionDto,
  ) {
    await this.getOrThrow(id);

    const incident = await this.prisma.incident.findUnique({
      where: { id },
    });

    const aiSuggestion = incident?.aiAgentSuggestion as Record<string, unknown> | null;

    const decision: Record<string, string | number | boolean | null> = {
      action: dto.action,
      timestamp: new Date().toISOString(),
      agentFinal:
        dto.agentId ||
        (aiSuggestion?.agentName as string) ||
        'unassigned',
      protocolFinal:
        dto.protocolOverride ||
        (aiSuggestion?.protocol as string) ||
        'STANDARD_RESPONSE',
      rulesFinal:
        dto.rulesOverride ||
        (aiSuggestion?.rulesOfEngagement as string) ||
        'Follow incident response playbook',
    };

    const updated = await this.prisma.incident.update({
      where: { id },
      data: { analystDecision: decision },
    });

    this.gateway.emitIncidentAnalysis({
      id: updated.id,
      analystDecision: updated.analystDecision,
    });

    return updated;
  }

  private async getOrThrow(id: string) {
    const incident = await this.prisma.incident.findUnique({ where: { id } });
    if (!incident) throw new NotFoundException(`Incident ${id} not found`);
    return incident;
  }
}
