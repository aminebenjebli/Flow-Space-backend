import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiResponse, ApiOperation, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { PointsService } from './points.service';
import { AchievementService } from './achievement.service';
import { LeaderboardService } from './leaderboard.service';
import { ChallengeService } from './challenge.service';
import {
  PointsDTO,
  UserStatsDTO,
  PointsHistoryDTO,
  AwardPointsDTO,
} from './dto/points.dto';
import {
  AchievementDefinitionDTO,
  UserAchievementDTO,
  AchievementProgressDTO,
  CreateAchievementDefinitionDTO,
} from './dto/achievement.dto';
import {
  LeaderboardEntryDTO,
  GlobalLeaderboardDTO,
  TeamLeaderboardDTO,
  UserRankDTO,
} from './dto/leaderboard.dto';
import {
  ChallengeDTO,
  CreateChallengeDTO,
  UserChallengeDTO,
  JoinChallengeResponseDTO,
} from './dto/challenge.dto';
import { JwtService } from '@nestjs/jwt';
import { TokenBlacklistService } from 'src/core/services/token-blacklist.service';
import { AuthGuard } from 'src/core/common/guards/auth.guard';

@ApiTags('Gamification')
@ApiBearerAuth()
@Controller('gamification')
export class GamificationController {
  constructor(
    private readonly pointsService: PointsService,
    private readonly achievementService: AchievementService,
    private readonly leaderboardService: LeaderboardService,
    private readonly challengeService: ChallengeService,
    private readonly jwtService: JwtService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    
  ) {}

  // ==================== POINTS ENDPOINTS ====================
  @Get('stats/:userId')
  @ApiOperation({ summary: 'AC-4: Get user statistics (points, level, streaks)' })
  @ApiResponse({ status: 200, description: 'User stats retrieved', type: UserStatsDTO })
  @ApiParam({ name: 'userId', description: 'User ID' })
  async getUserStats(@Param('userId') userId: string): Promise<UserStatsDTO> {
    return this.pointsService.getUserStats(userId);
  }

  @Get('points/history/:userId')
  @ApiOperation({ summary: 'AC-8: Get points history for a user' })
  @ApiResponse({ status: 200, description: 'Points history retrieved', type: PointsHistoryDTO })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of records to return' })
  async getPointsHistory(
    @Param('userId') userId: string,
    @Query('limit') limit?: number,
  ): Promise<PointsHistoryDTO> {
    return this.pointsService.getPointsHistory(userId, limit);
  }

  @Post('points/award')
  @ApiOperation({ summary: 'AC-1 & AC-2: Award points to a user' })
  @ApiResponse({ status: 201, description: 'Points awarded', type: PointsDTO })
  @HttpCode(HttpStatus.CREATED)
  async awardPoints(@Body() dto: AwardPointsDTO): Promise<PointsDTO> {
    return this.pointsService.awardPoints(
      dto.userId,
      dto.points,
      dto.reason,
      dto.taskId,
    );
  }

  // ==================== ACHIEVEMENT ENDPOINTS ====================
  @Get('achievements')
  @ApiOperation({ summary: 'Get all achievement definitions' })
  @ApiResponse({
    status: 200,
    description: 'All achievements retrieved',
    type: [AchievementDefinitionDTO],
  })
  async getAllAchievements(): Promise<AchievementDefinitionDTO[]> {
    return this.achievementService.getAllAchievements();
  }

  @Get('achievements/user/:userId')
  @ApiOperation({ summary: 'AC-3: Get user\'s unlocked achievements' })
  @ApiResponse({
    status: 200,
    description: 'User achievements retrieved',
    type: [UserAchievementDTO],
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  async getUserAchievements(@Param('userId') userId: string): Promise<UserAchievementDTO[]> {
    return this.achievementService.getUserAchievements(userId);
  }

  @Get('achievements/:achievementId/progress/:userId')
  @ApiOperation({ summary: 'Get achievement progress for a user' })
  @ApiResponse({
    status: 200,
    description: 'Achievement progress retrieved',
    type: AchievementProgressDTO,
  })
  @ApiParam({ name: 'achievementId', description: 'Achievement ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  async getAchievementProgress(
    @Param('userId') userId: string,
    @Param('achievementId') achievementId: string,
  ): Promise<AchievementProgressDTO> {
    return this.achievementService.getAchievementProgress(userId, achievementId);
  }

  @Post('achievements/check/:userId')
  @ApiOperation({ summary: 'AC-3 & AC-7: Check and unlock achievements for a user' })
  @ApiResponse({
    status: 200,
    description: 'Newly unlocked achievements',
    type: [UserAchievementDTO],
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  async checkAchievements(@Param('userId') userId: string): Promise<UserAchievementDTO[]> {
    return this.achievementService.checkAndUnlockAchievements(userId);
  }

  @Get('achievements/unnotified/:userId')
  @ApiOperation({ summary: 'AC-7: Get unnotified achievements for a user' })
  @ApiResponse({
    status: 200,
    description: 'Unnotified achievements retrieved',
    type: [UserAchievementDTO],
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  async getUnnotifiedAchievements(@Param('userId') userId: string): Promise<UserAchievementDTO[]> {
    return this.achievementService.getUnnotifiedAchievements(userId);
  }

  @Post('achievements/notify/:userId/:achievementId')
  @ApiOperation({ summary: 'AC-7: Mark achievement as notified' })
  @ApiResponse({ status: 200, description: 'Achievement marked as notified' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'achievementId', description: 'Achievement ID' })
  @HttpCode(HttpStatus.OK)
  async markAsNotified(
    @Param('userId') userId: string,
    @Param('achievementId') achievementId: string,
  ): Promise<{ success: boolean }> {
    await this.achievementService.markAchievementAsNotified(userId, achievementId);
    return { success: true };
  }

  @Post('achievements/create')
  @ApiOperation({ summary: 'Admin: Create new achievement definition' })
  @ApiResponse({
    status: 201,
    description: 'Achievement created',
    type: AchievementDefinitionDTO,
  })
  @HttpCode(HttpStatus.CREATED)
  async createAchievement(@Body() dto: CreateAchievementDefinitionDTO): Promise<AchievementDefinitionDTO> {
    return this.achievementService.createAchievementDefinition(dto);
  }

  // ==================== LEADERBOARD ENDPOINTS ====================
  @Get('leaderboard/team/:teamId')
  @ApiOperation({ summary: 'AC-5: Get team leaderboard' })
  @ApiResponse({
    status: 200,
    description: 'Team leaderboard retrieved',
    type: TeamLeaderboardDTO,
  })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of entries to return' })
  async getTeamLeaderboard(
    @Param('teamId') teamId: string,
    @Query('limit') limit?: number,
  ): Promise<TeamLeaderboardDTO> {
    try {
      const leaderboard = await this.leaderboardService.getTeamLeaderboard(teamId, limit);
      return leaderboard;
    } catch (error) {
      if (error.message === 'Team not found') {
        throw new NotFoundException('Team not found');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  @Get('leaderboard/rank/:userId')
  @ApiOperation({ summary: 'Get user\'s global rank' })
  @ApiResponse({ status: 200, description: 'User rank retrieved', type: UserRankDTO })
  @ApiParam({ name: 'userId', description: 'User ID' })
  async getUserRank(@Param('userId') userId: string): Promise<UserRankDTO> {
    return this.leaderboardService.getUserRank(userId);
  }

  // ==================== CHALLENGE ENDPOINTS ====================
  @Get('challenges')
  @ApiOperation({ summary: 'AC-6: Get active challenges' })
  @ApiResponse({ status: 200, description: 'Active challenges retrieved', type: [ChallengeDTO] })
  @ApiQuery({ name: 'userId', required: false, description: 'User ID to check participation' })
  async getActiveChallenges(@Query('userId') userId?: string): Promise<ChallengeDTO[]> {
    return this.challengeService.getActiveChallenges(userId);
  }

  @Post('challenges')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'AC-6: Create new challenge (admin)' })
  @ApiResponse({ status: 201, description: 'Challenge created', type: ChallengeDTO })
  @HttpCode(HttpStatus.CREATED)
  async createChallenge(@Request() req: any, @Body() dto: CreateChallengeDTO): Promise<ChallengeDTO> {
    return this.challengeService.createChallenge(req.user.sub, dto);
  }

  @Post('challenges/:challengeId/join/:userId')
  @ApiOperation({ summary: 'US-18: User joins a challenge' })
  @ApiResponse({
    status: 201,
    description: 'Successfully joined challenge',
    type: JoinChallengeResponseDTO,
  })
  @ApiParam({ name: 'challengeId', description: 'Challenge ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @HttpCode(HttpStatus.CREATED)
  async joinChallenge(
    @Param('userId') userId: string,
    @Param('challengeId') challengeId: string,
  ): Promise<JoinChallengeResponseDTO> {
    return this.challengeService.joinChallenge(userId, challengeId);
  }

  @Get('challenges/user/:userId')
  @ApiOperation({ summary: 'Get user\'s active challenges' })
  @ApiResponse({
    status: 200,
    description: 'User challenges retrieved',
    type: [UserChallengeDTO],
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  async getUserChallenges(@Param('userId') userId: string): Promise<UserChallengeDTO[]> {
    return this.challengeService.getUserChallenges(userId);
  }

  @Post('challenges/:challengeId/complete/:userId')
  @ApiOperation({ summary: 'Complete a challenge' })
  @ApiResponse({ status: 200, description: 'Challenge completed', type: UserChallengeDTO })
  @ApiParam({ name: 'challengeId', description: 'Challenge ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @HttpCode(HttpStatus.OK)
  async completeChallenge(
    @Param('userId') userId: string,
    @Param('challengeId') challengeId: string,
  ): Promise<UserChallengeDTO> {
    return this.challengeService.completeChallenge(userId, challengeId);
  }
}
