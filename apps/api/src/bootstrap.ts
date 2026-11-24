import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Configuration commune à l'application et aux tests. */
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidUnknownValues: false }));
  const doc = new DocumentBuilder()
    .setTitle('API Livraison de quartier')
    .setDescription('API unique des applications client, commerçant, livreur et de la console d’administration (MVP Gagnoa).')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc));
  return app;
}
