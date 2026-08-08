import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { appConfig } from './config/app.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Strips unknown fields and rejects malformed payloads at the edge —
  // sensors will send garbage sooner or later, better to fail loud here
  // than to let bad data reach the correlation engine.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Needed to read the httpOnly refreshToken cookie off incoming
  // requests (see AuthController).
  app.use(cookieParser());

  // Restricted to the actual frontend origin(s), not a wildcard —
  // required anyway for cookies to work cross-origin: browsers refuse
  // to send/accept credentialed cookies with Access-Control-Allow-Origin: *.
  app.enableCors({
    origin: appConfig.frontendOrigins,
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`[section-8-half] listening on port ${port}`);
}
bootstrap();
