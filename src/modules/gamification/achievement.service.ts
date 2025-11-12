import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/core/services/prisma.service';
import {
  AchievementDefinitionDTO,
  UserAchievementDTO,
  AchievementProgressDTO,
  CreateAchievementDefinitionDTO,
} from './dto/achievement.dto';

@Injectable()
export class AchievementService {
  constructor(private prisma: PrismaService) {}

  // Get all achievement definitions (global achievements available)
  async getAllAchievements(): Promise<AchievementDefinitionDTO[]> {
    const achievements = await this.prisma.achievementDefinition.findMany({
      orderBy: { targetValue: 'asc' },
    });

    return achievements.map((achievement) => ({
      id: achievement.id,
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      pointsAwarded: achievement.pointsAwarded,
      criteria: achievement.criteria,
      targetValue: achievement.targetValue,
      createdAt: achievement.createdAt,
    }));
  }

  // AC-3: Get user's unlocked achievements
  async getUserAchievements(userId: string): Promise<UserAchievementDTO[]> {
    const userAchievements = await this.prisma.userAchievement.findMany({
      where: { userId },
      include: {
        achievement: true,
      },
      orderBy: { unlockedAt: 'desc' },
    });

    return userAchievements.map((ua) => ({
      id: ua.id,
      achievementId: ua.achievementId,
      name: ua.achievement.name,
      description: ua.achievement.description,
      icon: ua.achievement.icon,
      pointsAwarded: ua.achievement.pointsAwarded,
      progress: ua.progress,
      targetValue: ua.achievement.targetValue,
      unlockedAt: ua.unlockedAt,
      notified: ua.notified,
      isUnlocked: ua.progress >= ua.achievement.targetValue,
    }));
  }

  // Get achievement progress for a user
  async getAchievementProgress(
    userId: string,
    achievementId: string
  ): Promise<AchievementProgressDTO> {
    const achievement = await this.prisma.achievementDefinition.findUnique({
      where: { id: achievementId },
    });

    if (!achievement) {
      throw new NotFoundException('Achievement not found');
    }

    const userAchievement = await this.prisma.userAchievement.findUnique({
      where: {
        userId_achievementId: {
          userId,
          achievementId,
        },
      },
    });

    const progress = userAchievement?.progress || 0;
    const isUnlocked = progress >= achievement.targetValue;

    return {
      achievementId: achievement.id,
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      progress,
      targetValue: achievement.targetValue,
      percentage: Math.min((progress / achievement.targetValue) * 100, 100),
      isUnlocked,
    };
  }

  // AC-3 & AC-7: Check and unlock achievements for a user
  async checkAndUnlockAchievements(userId: string): Promise<UserAchievementDTO[]> {
    const userStats = await this.prisma.userStats.findUnique({
      where: { userId },
    });

    if (!userStats) {
      return [];
    }

    const allAchievements = await this.prisma.achievementDefinition.findMany();
    const newlyUnlocked: UserAchievementDTO[] = [];

    for (const achievement of allAchievements) {
      let currentProgress = 0;

      // Determine progress based on criteria
      switch (achievement.criteria) {
        case 'COMPLETE_50_TASKS':
        case 'COMPLETE_100_TASKS':
        case 'COMPLETE_200_TASKS':
          currentProgress = userStats.tasksCompleted;
          break;
        case '7_DAY_STREAK':
        case '30_DAY_STREAK':
        case '100_DAY_STREAK':
          currentProgress = userStats.currentStreak;
          break;
        case 'REACH_LEVEL_5':
        case 'REACH_LEVEL_10':
        case 'REACH_LEVEL_20':
          currentProgress = userStats.level;
          break;
        case 'EARN_1000_POINTS':
        case 'EARN_5000_POINTS':
        case 'EARN_10000_POINTS':
          currentProgress = userStats.totalPoints;
          break;
        default:
          continue;
      }

      // Check if achievement should be unlocked
      if (currentProgress >= achievement.targetValue) {
        const existing = await this.prisma.userAchievement.findUnique({
          where: {
            userId_achievementId: {
              userId,
              achievementId: achievement.id,
            },
          },
        });

        if (!existing) {
          // Unlock new achievement
          const unlocked = await this.prisma.userAchievement.create({
            data: {
              userId,
              achievementId: achievement.id,
              progress: currentProgress,
              notified: false,
            },
            include: {
              achievement: true,
            },
          });

          // Award points for unlocking achievement
          await this.prisma.points.create({
            data: {
              userId,
              points: achievement.pointsAwarded,
              reason: `ACHIEVEMENT_UNLOCKED: ${achievement.name}`,
            },
          });

          // Update user's total points
          await this.prisma.userStats.update({
            where: { userId },
            data: {
              totalPoints: {
                increment: achievement.pointsAwarded,
              },
            },
          });

          const achievementDTO = {
            id: unlocked.id,
            achievementId: unlocked.achievementId,
            name: unlocked.achievement.name,
            description: unlocked.achievement.description,
            icon: unlocked.achievement.icon,
            pointsAwarded: unlocked.achievement.pointsAwarded,
            progress: unlocked.progress,
            targetValue: unlocked.achievement.targetValue,
            unlockedAt: unlocked.unlockedAt,
            notified: unlocked.notified,
            isUnlocked: true,
          };

          newlyUnlocked.push(achievementDTO);
        } else if (existing.progress < currentProgress) {
          // Update progress
          await this.prisma.userAchievement.update({
            where: {
              userId_achievementId: {
                userId,
                achievementId: achievement.id,
              },
            },
            data: {
              progress: currentProgress,
            },
          });
        }
      }
    }

    return newlyUnlocked;
  }

  // AC-7: Mark achievement notifications as read
  async markAchievementAsNotified(userId: string, achievementId: string): Promise<void> {
    await this.prisma.userAchievement.updateMany({
      where: {
        userId,
        achievementId,
      },
      data: {
        notified: true,
      },
    });
  }

  // Get unnotified achievements for a user
  async getUnnotifiedAchievements(userId: string): Promise<UserAchievementDTO[]> {
    const unnotified = await this.prisma.userAchievement.findMany({
      where: {
        userId,
        notified: false,
      },
      include: {
        achievement: true,
      },
    });

    return unnotified.map((ua) => ({
      id: ua.id,
      achievementId: ua.achievementId,
      name: ua.achievement.name,
      description: ua.achievement.description,
      icon: ua.achievement.icon,
      pointsAwarded: ua.achievement.pointsAwarded,
      progress: ua.progress,
      targetValue: ua.achievement.targetValue,
      unlockedAt: ua.unlockedAt,
      notified: ua.notified,
      isUnlocked: true,
    }));
  }

  // Admin: Create new achievement definition
  async createAchievementDefinition(
    dto: CreateAchievementDefinitionDTO
  ): Promise<AchievementDefinitionDTO> {
    const achievement = await this.prisma.achievementDefinition.create({
      data: {
        name: dto.name,
        description: dto.description,
        icon: dto.icon,
        pointsAwarded: dto.pointsAwarded,
        criteria: dto.criteria,
        targetValue: dto.targetValue,
      },
    });

    return {
      id: achievement.id,
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      pointsAwarded: achievement.pointsAwarded,
      criteria: achievement.criteria,
      targetValue: achievement.targetValue,
      createdAt: achievement.createdAt,
    };
  }
}
