import { Module } from '@nestjs/common';
import { PointsService } from './points.service';
import { AchievementService } from './achievement.service';
import { LeaderboardService } from './leaderboard.service';
import { ChallengeService } from './challenge.service';
import { GamificationController } from './gamification.controller';
import { PrismaService } from 'src/core/services/prisma.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from 'src/core/common/guards/auth.guard';
import { TokenBlacklistService } from 'src/core/services/token-blacklist.service';



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
  ],
  controllers: [GamificationController],
  providers: [
    PointsService,
    AchievementService,
    LeaderboardService,
    ChallengeService,
    PrismaService,
    AuthGuard,
    TokenBlacklistService,
  ],
  exports: [
    PointsService,
    AchievementService,
    LeaderboardService,
    ChallengeService,
  ],
})
export class GamificationModule {}