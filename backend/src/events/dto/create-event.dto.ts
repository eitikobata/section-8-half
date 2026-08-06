import {
  IsString,
  IsInt,
  IsOptional,
  IsISO8601,
  Min,
  Max,
  IsObject,
} from 'class-validator';

// Mirrors the payload shape defined in the project spec:
// { entity_id, event_type, location, timestamp, severity_raw }
// Field names below use camelCase; if sensors send snake_case JSON,
// map it in the controller/service layer (kept explicit on purpose).
export class CreateEventDto {
  @IsString()
  entityId: string;

  @IsString()
  eventType: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsInt()
  @Min(0)
  @Max(100)
  severityRaw: number;

  @IsISO8601()
  timestamp: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
