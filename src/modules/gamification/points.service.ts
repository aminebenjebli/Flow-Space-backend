import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from 'src/core/services/prisma.service';
import { PointsDTO, UserStatsDTO, PointsHistoryDTO } from './dto/points.dto';

@Injectable()
export class PointsService {
  constructor(private prisma: PrismaService) {}

  // AC-1 & AC-2: Award points to a user
  async awardPoints(
    userId: string,
    points: number,
    reason: string,
    taskId?: string
  ): Promise<PointsDTO> {
    // Create points transaction record
    const pointsRecord = await this.prisma.points.create({
      data: {
        userId,
        taskId,
        points,
        reason,
      },
    });

    // Update user stats
    await this.updateUserStats(userId, points);

    return {
      id: pointsRecord.id,
      userId: pointsRecord.userId,
      taskId: pointsRecord.taskId,
      points: pointsRecord.points,
      reason: pointsRecord.reason,
      createdAt: pointsRecord.createdAt,
    };
  }

  // AC-4 & AC-9: Get user statistics
  async getUserStats(userId: string): Promise<UserStatsDTO> {
    let userStats = await this.prisma.userStats.findUnique({
      where: { userId },
    });

    if (!userStats) {
      userStats = await this.prisma.userStats.create({
        data: { userId },
      });
    }

    return {
      id: userStats.id,
      userId: userStats.userId,
      totalPoints: userStats.totalPoints,
      level: userStats.level,
      currentStreak: userStats.currentStreak,
      longestStreak: userStats.longestStreak,
      tasksCompleted: userStats.tasksCompleted,
      lastActiveDate: userStats.lastActiveDate,
    };
  }

  // AC-8: Get points history
  async getPointsHistory(userId: string, limit?: number): Promise<PointsHistoryDTO> {
    const history = await this.prisma.points.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit || 100,
    });

    const totalPoints = history.reduce((sum, record) => sum + record.points, 0);

    return {
      history: history.map((record) => ({
        id: record.id,
        userId: record.userId,
        taskId: record.taskId,
        points: record.points,
        reason: record.reason,
        createdAt: record.createdAt,
      })),
      totalPoints,
      count: history.length,
    };
  }

  // AC-9: Calculate level
  calculateLevel(totalPoints: number): number {
    return Math.floor(totalPoints / 100) + 1;
  }

  // Helper: Update user stats
  private async updateUserStats(userId: string, pointsToAdd: number): Promise<void> {
    const userStats = await this.prisma.userStats.findUnique({
      where: { userId },
    });

    if (!userStats) {
      await this.prisma.userStats.create({
        data: {
          userId,
          totalPoints: pointsToAdd,
          level: this.calculateLevel(pointsToAdd),
        },
      });
    } else {
      const newTotalPoints = userStats.totalPoints + pointsToAdd;
      const newLevel = this.calculateLevel(newTotalPoints);

      await this.prisma.userStats.update({
        where: { userId },
        data: {
          totalPoints: newTotalPoints,
          level: newLevel,
        },
      });
    }
  }

  // AC-3: Update streak
  async updateStreak(userId: string): Promise<void> {
    const userStats = await this.prisma.userStats.findUnique({
      where: { userId },
    });

    if (!userStats) {
      await this.prisma.userStats.create({
        data: {
          userId,
          currentStreak: 1,
          longestStreak: 1,
          lastActiveDate: new Date(),
        },
      });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastActive = new Date(userStats.lastActiveDate);
    lastActive.setHours(0, 0, 0, 0);

    const daysDifference = Math.floor(
      (today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDifference === 0) {
      return;
    } else if (daysDifference === 1) {
      const newStreak = userStats.currentStreak + 1;
      await this.prisma.userStats.update({
        where: { userId },
        data: {
          currentStreak: newStreak,
          longestStreak: Math.max(userStats.longestStreak, newStreak),
          lastActiveDate: new Date(),
        },
      });
    } else {
      await this.prisma.userStats.update({
        where: { userId },
        data: {
          currentStreak: 1,
          lastActiveDate: new Date(),
        },
      });
    }
  }

  // Helper: Increment tasks completed
  async incrementTasksCompleted(userId: string): Promise<void> {
    const userStats = await this.prisma.userStats.findUnique({
      where: { userId },
    });

    if (userStats) {
      await this.prisma.userStats.update({
        where: { userId },
        data: {
          tasksCompleted: userStats.tasksCompleted + 1,
        },
      });
    }
  }

  // Main method for task completion
  async handleTaskCompletion(
    userId: string,
    taskId: string,
    isEarlyCompletion: boolean
  ): Promise<{ points: number; bonusPoints: number }> {
    await this.awardPoints(userId, 10, 'TASK_COMPLETION', taskId);

    let bonusPoints = 0;
    if (isEarlyCompletion) {
      await this.awardPoints(userId, 5, 'EARLY_BONUS', taskId);
      bonusPoints = 5;
    }

    await this.updateStreak(userId);
    await this.incrementTasksCompleted(userId);

    return { points: 10, bonusPoints };
  }
}
