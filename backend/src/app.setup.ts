import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppConfig } from './infrastructure/config/app-config';

/** Security headers, CORS, input validation and API docs, shared by local and Lambda entry points. */
export const API_PREFIX = 'api';

export const configureApp = (
  app: INestApplication,
  config: AppConfig,
): INestApplication => {
  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.enableCors({
    origin: config.corsOrigins,
    methods: ['GET', 'POST'],
    maxAge: 600,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Checkout API')
      .setDescription(
        'Products, checkout quotes, customers, transactions and deliveries',
      )
      .setVersion('1.0.0')
      .build(),
  );
  SwaggerModule.setup(`${API_PREFIX}/docs`, app, document, {
    jsonDocumentUrl: `${API_PREFIX}/docs/json`,
  });
  return app;
};
