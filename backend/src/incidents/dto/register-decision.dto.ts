import { IsIn, IsOptional, IsString } from 'class-validator';

/**
 * Analyst decision on AI suggestion:
 * - accept: use AI recommendation as-is
 * - partial: keep some aspects (agent or protocol), override others
 * - reject: ignore AI suggestion, provide own values
 */
export class RegisterDecisionDto {
  @IsIn(['accept', 'partial', 'reject'])
  action: 'accept' | 'partial' | 'reject';

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsString()
  protocolOverride?: string;

  @IsOptional()
  @IsString()
  rulesOverride?: string;
}
