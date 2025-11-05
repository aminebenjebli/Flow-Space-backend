import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../../core/services/prisma.service';
import { TokenBlacklistService } from '../../core/services/token-blacklist.service';
import { AuthGuard } from '../../core/common/guards/auth.guard';
import { TeamModule } from '../team/team.module';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { TaskAiModule } from '../task-ai/task-ai.module';

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
        }),
        TaskAiModule,
        TeamModule // Import TeamModule to access TeamAccessService
    ],
    controllers: [TaskController],
    providers: [TaskService, PrismaService, TokenBlacklistService, AuthGuard],
    exports: [TaskService]
})
export class TaskModule {}
