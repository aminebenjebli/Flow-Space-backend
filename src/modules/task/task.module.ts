import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../../core/services/prisma.service';
import { AuthGuard } from '../../core/common/guards/auth.guard';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';

@Module({
    imports: [
        ConfigModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET', 'secret'),
                signOptions: { expiresIn: '1d' }
            })
        })
    ],
    controllers: [TaskController],
    providers: [TaskService, PrismaService, AuthGuard],
    exports: [TaskService]
})
export class TaskModule {}
