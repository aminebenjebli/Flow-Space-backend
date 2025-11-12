import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/services/prisma.service';
import {
  LeaderboardEntryDTO,
  TeamLeaderboardDTO,
  UserRankDTO,
} from './dto/leaderboard.dto';

@Injectable()
export class LeaderboardService {
  isTeamExists: any;
  constructor(private prisma: PrismaService) {}

  // AC-5: Get team leaderboard (team-specific rankings)
  async getTeamLeaderboard(teamId: string, limit: number = 50): Promise<TeamLeaderboardDTO> {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { name: true },
    });
    if (!team) {
      throw new Error('Team not found');
    }
    const teamMembers = await this.prisma.teamMember.findMany({
      where: { teamId },
      select: { userId: true },
    });
    const userIds = teamMembers.map((member) => member.userId);
    const userStats = await this.prisma.userStats.findMany({
      where: {
        userId: { in: userIds },
      },
      orderBy: { totalPoints: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
          },
        },
      },
    });
    const entries: LeaderboardEntryDTO[] = userStats.map((stats, index) => ({
      userId: stats.userId,
      username: stats.user.name,
      profilePicture: stats.user.profilePicture,
      totalPoints: stats.totalPoints,
      level: stats.level,
      rank: index + 1,
      tasksCompleted: stats.tasksCompleted,
      currentStreak: stats.currentStreak,
    }));
    const result = {
      teamId,
      teamName: team.name,
      entries,
      total: entries.length,
      lastUpdated: new Date(),
    };
    return result;
  }

  // Get user's rank in global leaderboard
  async getUserRank(userId: string): Promise<UserRankDTO> {
    const userStats = await this.prisma.userStats.findUnique({
      where: { userId },
    });
    if (!userStats) {
      throw new Error('User stats not found');
    }
    const rank = await this.prisma.userStats.count({
      where: {
        totalPoints: { gt: userStats.totalPoints },
      },
    });
    const totalUsers = await this.prisma.userStats.count();
    const pointsToNextLevel = (userStats.level * 100) - userStats.totalPoints;
    return {
      userId,
      globalRank: rank + 1,
      totalUsers,
      totalPoints: userStats.totalPoints,
      level: userStats.level,
      pointsToNextLevel: Math.max(0, pointsToNextLevel),
    };
  }

  
  // Get user's rank within a specific team
  async getUserTeamRank(userId: string, teamId: string): Promise<number> {
    const teamMembers = await this.prisma.teamMember.findMany({
      where: { teamId },
      select: { userId: true },
    });
    const userIds = teamMembers.map((member) => member.userId);
    const userStats = await this.prisma.userStats.findUnique({
      where: { userId },
    });
    if (!userStats) {
      throw new Error('User stats not found');
    }
    const rank = await this.prisma.userStats.count({
      where: {
        userId: { in: userIds },
        totalPoints: { gt: userStats.totalPoints },
      },
    });
    return rank + 1;
  }
}
