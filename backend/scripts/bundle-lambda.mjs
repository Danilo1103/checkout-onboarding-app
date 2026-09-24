/**
 * Bundles the tsc output (which keeps decorator metadata required by Nest
 * validation and dependency injection) into a single file for AWS Lambda.
 */
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const outdir = 'dist-lambda';
rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

// Optional Nest integrations that this app does not use.
const optional = [
  '@nestjs/microservices',
  '@nestjs/microservices/microservices-module',
  '@nestjs/websockets',
  '@nestjs/websockets/socket-module',
  'class-transformer/storage',
  '@fastify/static',
];

await build({
  entryPoints: ['dist/lambda.js'],
  outfile: join(outdir, 'index.js'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  minify: true,
  keepNames: true,
  sourcemap: false,
  external: [...optional, '@aws-sdk/*', 'swagger-ui-dist'],
  logLevel: 'warning',
});

// Swagger UI serves its static files from disk, so they ship next to the bundle.
const require = createRequire(import.meta.url);
const swaggerUi = dirname(require.resolve('swagger-ui-dist/package.json'));
cpSync(swaggerUi, join(outdir, 'node_modules', 'swagger-ui-dist'), { recursive: true });
console.log('Lambda bundle ready in', outdir);
