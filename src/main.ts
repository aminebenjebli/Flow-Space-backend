import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as compression from 'compression';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  try {
    logger.log('🚀 Starting NestJS application...');
    
    const app = await NestFactory.create(AppModule, {
      bufferLogs: true,
      logger: ['error', 'warn', 'log', 'debug'],
    });
    
    logger.log('✅ Application instance created successfully');

    const configService = app.get(ConfigService);

    // Global prefix
 app.setGlobalPrefix('api');
app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',
});
    logger.log('API versioning enabled with default version: 1');

    // Security
    app.use(helmet());
    logger.log('Helmet security enabled');

    // CORS
    const allowedOrigins = configService.get('ALLOWED_ORIGINS', '*');
    app.enableCors({
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      credentials: true,
    });
    logger.log(`CORS enabled for origins: ${allowedOrigins}`);

    // Compression
    app.use(compression());
    logger.log('Response compression enabled');

    // Validation
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      })
    );
    logger.log('Global validation pipe configured');

    // Swagger
    const swaggerConfig = new DocumentBuilder()
      .setTitle('FlowSpace API')
      .setDescription('API for FlowSpace Task Management')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('Swagger documentation setup at: /api/docs');

    // Start server
    const port = configService.get('PORT', 8050);
    await app.listen(port);
    
    logger.log(`🚀 Application is running on: http://localhost:${port}`);
    logger.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
    logger.log(`🎮 API base path: http://localhost:${port}/api/v1`);
  } catch (error) {
    logger.error('❌ Failed to start application:', error);
    logger.error(error.stack);
    process.exit(1);
  }
}

bootstrap();