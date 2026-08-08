import { IsOptional, IsString } from 'class-validator';

// refreshToken is optional in the body now: browsers get it from the
// httpOnly cookie set on login (see AuthController), which the frontend
// never has to read or send by hand. Kept optional here (not removed)
// so non-browser API clients (Postman, curl, mobile apps without a
// cookie jar) can still pass it explicitly in the body if they need to.
export class RefreshDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
