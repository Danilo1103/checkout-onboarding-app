import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { API_PREFIX } from '../src/app.setup';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(() => {
    Object.assign(process.env, {
      PAYMENT_API_URL: 'https://gateway.test/v1',
      PAYMENT_PUBLIC_KEY: 'pub_test',
      PAYMENT_PRIVATE_KEY: 'prv_test',
      PAYMENT_INTEGRITY_SECRET: 'integrity_test',
    });
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/health', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok' });
  });
});
