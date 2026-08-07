import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCommentDto {
  // author removed (Bloco 4.5) — it now comes from req.user.id,
  // set by JwtAuthGuard, instead of trusting whatever the client sends.
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;
}
