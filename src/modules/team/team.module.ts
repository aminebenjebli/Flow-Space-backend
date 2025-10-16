import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../../core/services/prisma.service';
import { TokenBlacklistService } from '../../core/services/token-blacklist.service';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { TeamAccessService } from './team-access.service';

@Module({
    imports: [
        ConfigModule,
        JwtModule.register({}) // Empty register for AuthGuard dependency
    ],
    controllers: [TeamController],
    providers: [
        TeamService,
        TeamAccessService,
        PrismaService,
        TokenBlacklistService
    ],
    exports: [TeamService, TeamAccessService] // Export for use in other modules
})
export class TeamModule {}