import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  const allowedOrigins = (
    process.env.CORS_ORIGINS || 'http://127.0.0.1:3100,http://localhost:3100'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
  });

  const port = Number(process.env.PORT || 4100);
  await app.listen(port, '0.0.0.0');

  console.log(`vinissimo-soi-api listening on port ${port}`);
}

bootstrap();
