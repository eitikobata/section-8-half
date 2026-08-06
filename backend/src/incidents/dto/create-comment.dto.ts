import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCommentDto {
  // Free text for now — no analyst/auth identity system yet.
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  author: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;
}
