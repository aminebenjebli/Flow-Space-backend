import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { LoggerMiddleware } from './core/common/middleware/logger.middleware';
import { PrismaService } from './core/services/prisma.service';
import { TokenBlacklistService } from './core/services/token-blacklist.service';
import { AuthModule } from './modules/auth/auth.module';
import { FileUploadModule } from './modules/file-upload/file-upload.module';
import { UserModule } from './modules/user/user.module';
import { TaskModule } from './modules/task/task.module';
import { TeamModule } from './modules/team/team.module';
import { ProjectModule } from './modules/project/project.module';

@Module({
    imports: [
        // Environment Configuration
        ConfigModule.forRoot({
            isGlobal: true,
            cache: true
        }),

        // Rate Limiting
        ThrottlerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => [
                {
                    ttl: config.get('THROTTLE_TTL', 60),
                    limit: config.get('THROTTLE_LIMIT', 100)
                }
            ]
        }),

        // Email Configuration
        MailerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                transport: {
                    host: config.get<string>('EMAIL_HOST'),
                    port: config.get<number>('EMAIL_PORT'),
                    secure: true, // Set to true if using SSL (port 465)
                    auth: {
                        user: config.get<string>('EMAIL_USER'),
                        pass: config.get<string>('EMAIL_PASSWORD')
                    }
                },
                defaults: {
                    from: `"BOM" <${config.get<string>('EMAIL_FROM')}>`
                },
                template: {
                    dir: join(__dirname, 'templates'),
                    adapter: new HandlebarsAdapter()
                }
            })
        }),

        FileUploadModule,
        AuthModule,
        UserModule,
        TaskModule,
        TeamModule,
        ProjectModule
    ],
    controllers: [],
    providers: [PrismaService, TokenBlacklistService]
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(LoggerMiddleware).forRoutes('*');
    }
}
