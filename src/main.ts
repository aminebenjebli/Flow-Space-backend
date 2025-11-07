import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import * as compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import setupSwagger from './core/config/swagger.config';

// Global error handlers to surface uncaught errors during bootstrap
process.on('unhandledRejection', (reason) => {
    console.error('[UnhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
    console.error('[UncaughtException]', err && err.stack ? err.stack : err);
});

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        bufferLogs: true
    });

    // Get ConfigService
    const configService = app.get(ConfigService);

    // Global prefix and versioning
    app.setGlobalPrefix('api');
    app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1'
    });

    // Security
    app.use(helmet());

    app.enableCors({
        origin: configService.get('ALLOWED_ORIGINS', '*'),
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        credentials: true
    });

    // Compression
    app.use(compression());

    // Validation
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
            transformOptions: {
                enableImplicitConversion: true
            }
        })
    );

    // Swagger Setup
    setupSwagger(app);

    await app.listen(configService.get('PORT', 3000));
}
bootstrap();
