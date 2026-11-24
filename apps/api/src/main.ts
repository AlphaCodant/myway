import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { UPLOAD_DIR } from './modules/uploads/uploads.controller';

async function main() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  app.useStaticAssets(UPLOAD_DIR, { prefix: '/uploads/', maxAge: '30d' });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`API prête sur http://localhost:${port}/api — documentation : http://localhost:${port}/api/docs`);
}
main();
