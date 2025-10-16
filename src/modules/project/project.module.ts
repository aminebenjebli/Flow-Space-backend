import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../../core/services/prisma.service';
import { TokenBlacklistService } from '../../core/services/token-blacklist.service';
import { TeamModule } from '../team/team.module';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';

@Module({
    imports: [
        ConfigModule,
        JwtModule.register({}), // Empty register for AuthGuard dependency
        TeamModule // Import TeamModule to access TeamAccessService
    ],
    controllers: [ProjectController],
    providers: [
        ProjectService,
        PrismaService,
        TokenBlacklistService
    ],
    exports: [ProjectService] // Export for use in other modules
})
export class ProjectModule {}