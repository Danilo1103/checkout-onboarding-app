import serverlessExpress from '@codegenie/serverless-express';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Callback, Context, Handler } from 'aws-lambda';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { APP_CONFIG, AppConfig } from './infrastructure/config/app-config';
import { loadSecrets } from './infrastructure/config/load-secrets';

let server: Handler | undefined;

/** Builds the Nest app once per Lambda instance and reuses it across invocations. */
export const bootstrap = async (): Promise<Handler> => {
  await loadSecrets();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  // API Gateway adds the client IP as the last X-Forwarded-For hop; trust only that hop.
  app.set('trust proxy', 1);
  configureApp(app, app.get<AppConfig>(APP_CONFIG));
  await app.init();
  return serverlessExpress({ app: app.getHttpAdapter().getInstance() });
};

export const handler: Handler = async (
  event: unknown,
  context: Context,
  callback: Callback,
) => {
  server ??= await bootstrap();
  return (await server(event, context, callback)) as unknown;
};
