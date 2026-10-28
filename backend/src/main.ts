import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Toàn bộ endpoint nằm dưới /api/v1
  app.setGlobalPrefix('api/v1');

  // Đọc refresh token từ HttpOnly cookie
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // Chỉ cho phép origin của Web (không dùng '*')
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });

  app.getHttpAdapter().getInstance().disable('x-powered-by');

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('AI-Powered Internal ATS — Core API')
      .setDescription(
        'API quản lý tuyển dụng: auth, campaign, candidate, evaluation, blind scoring',
      )
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  Logger.log(`Core API : http://localhost:${port}/api/v1/health`, 'Bootstrap');
  Logger.log(`Swagger  : http://localhost:${port}/api/docs`, 'Bootstrap');
}

void bootstrap();
