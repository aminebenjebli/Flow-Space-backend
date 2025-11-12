import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/core/services/prisma.service';
import {
  ChallengeDTO,
  CreateChallengeDTO,
  UserChallengeDTO,
  JoinChallengeResponseDTO,
} from './dto/challenge.dto';

@Injectable()
export class ChallengeService {
  constructor(private prisma: PrismaService) {}

  // AC-6: Get active challenges
  async getActiveChallenges(userId?: string): Promise<ChallengeDTO[]> {
    // Get the user's teams
    const userTeams = await this.prisma.teamMember.findMany({
      where: { userId: userId },
      select: { teamId: true },
    });
    const teamIds = userTeams.map((team) => team.teamId);

    const challenges = await this.prisma.challenge.findMany({
      where: {
        isActive: true,
        endDate: { gte: new Date() },
        teamId: { in: teamIds },
      },
      orderBy: { startDate: 'desc' },
    });

    return Promise.all(
      challenges.map(async (challenge) => {
        const participantCount = await this.prisma.userChallenge.count({
          where: { challengeId: challenge.id },
        });
        let userJoined = false;
        let userCompleted = false;
        if (userId) {
          const userParticipation = await this.prisma.userChallenge.findUnique({
            where: {
              userId_challengeId: {
                userId,
                challengeId: challenge.id,
              },
            },
          });
          userJoined = !!userParticipation;
          userCompleted = userParticipation?.completed || false;
        }
        return {
          id: challenge.id,
          name: challenge.name,
          description: challenge.description,
          pointsRewarded: challenge.pointsRewarded,
          startDate: challenge.startDate,
          endDate: challenge.endDate,
          isActive: challenge.isActive,
          createdAt: challenge.createdAt,
          participantCount,
          userJoined,
          userCompleted,
        };
      })
    );
  }

  // AC-6: Create new challenge (admin)
  async createChallenge(userId: string, dto: CreateChallengeDTO): Promise<ChallengeDTO> {
    // Check if the user is an OWNER of the team
    const teamMember = await this.prisma.teamMember.findFirst({
      where: {
        userId: userId,
        teamId: dto.teamId,
        role: 'OWNER',
      },
    });
    if (!teamMember) {
      throw new BadRequestException('Only team owners can create challenges');
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    const challenge = await this.prisma.challenge.create({
      data: {
        name: dto.name,
        description: dto.description,
        pointsRewarded: dto.pointsRewarded,
        startDate,
        endDate,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        teamId: dto.teamId,
      },
    });

    return {
      id: challenge.id,
      name: challenge.name,
      description: challenge.description,
      pointsRewarded: challenge.pointsRewarded,
      startDate: challenge.startDate,
      endDate: challenge.endDate,
      isActive: challenge.isActive,
      createdAt: challenge.createdAt,
      participantCount: 0,
      userJoined: false,
      userCompleted: false,
    };
  }

  // US-18: User joins a challenge
  async joinChallenge(userId: string, challengeId: string): Promise<JoinChallengeResponseDTO> {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
    });
    if (!challenge) {
      throw new NotFoundException('Challenge not found');
    }
    if (!challenge.isActive) {
      throw new BadRequestException('Challenge is not active');
    }
    if (new Date() > challenge.endDate) {
      throw new BadRequestException('Challenge has ended');
    }
    const existingParticipation = await this.prisma.userChallenge.findUnique({
      where: {
        userId_challengeId: {
          userId,
          challengeId,
        },
      },
    });
    if (existingParticipation) {
      throw new BadRequestException('You have already joined this challenge');
    }
    const userChallenge = await this.prisma.userChallenge.create({
      data: {
        userId,
        challengeId,
      },
    });
    const daysRemaining = Math.ceil(
      (challenge.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      success: true,
      message: 'Successfully joined challenge',
      userChallenge: {
        id: userChallenge.id,
        challengeId: userChallenge.challengeId,
        challengeName: challenge.name,
        challengeDescription: challenge.description,
        pointsRewarded: challenge.pointsRewarded,
        startDate: challenge.startDate,
        endDate: challenge.endDate,
        joinedAt: userChallenge.joinedAt,
        completed: userChallenge.completed,
        completedAt: userChallenge.completedAt,
        daysRemaining,
        isActive: challenge.isActive,
      },
    };
  }

  // Get user's active challenges
  async getUserChallenges(userId: string): Promise<UserChallengeDTO[]> {
    const userChallenges = await this.prisma.userChallenge.findMany({
      where: {
        userId,
        challenge: {
          endDate: { gte: new Date() },
        },
      },
      include: {
        challenge: true,
      },
      orderBy: { joinedAt: 'desc' },
    });
    return userChallenges.map((uc) => {
      const daysRemaining = Math.ceil(
        (uc.challenge.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        id: uc.id,
        challengeId: uc.challengeId,
        challengeName: uc.challenge.name,
        challengeDescription: uc.challenge.description,
        pointsRewarded: uc.challenge.pointsRewarded,
        startDate: uc.challenge.startDate,
        endDate: uc.challenge.endDate,
        joinedAt: uc.joinedAt,
        completed: uc.completed,
        completedAt: uc.completedAt,
        daysRemaining: Math.max(0, daysRemaining),
        isActive: uc.challenge.isActive,
      };
    });
  }

  // Complete a challenge for a user
  async completeChallenge(userId: string, challengeId: string): Promise<UserChallengeDTO> {
    const userChallenge = await this.prisma.userChallenge.findUnique({
      where: {
        userId_challengeId: {
          userId,
          challengeId,
        },
      },
      include: {
        challenge: true,
      },
    });
    if (!userChallenge) {
      throw new NotFoundException('Challenge participation not found');
    }
    if (userChallenge.completed) {
      throw new BadRequestException('Challenge already completed');
    }
    const updated = await this.prisma.userChallenge.update({
      where: {
        userId_challengeId: {
          userId,
          challengeId,
        },
      },
      data: {
        completed: true,
        completedAt: new Date(),
      },
      include: {
        challenge: true,
      },
    });
    await this.prisma.points.create({
      data: {
        userId,
        points: updated.challenge.pointsRewarded,
        reason: `CHALLENGE_COMPLETED: ${updated.challenge.name}`,
      },
    });
    await this.prisma.userStats.update({
      where: { userId },
      data: {
        totalPoints: {
          increment: updated.challenge.pointsRewarded,
        },
      },
    });
    const daysRemaining = Math.ceil(
      (updated.challenge.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      id: updated.id,
      challengeId: updated.challengeId,
      challengeName: updated.challenge.name,
      challengeDescription: updated.challenge.description,
      pointsRewarded: updated.challenge.pointsRewarded,
      startDate: updated.challenge.startDate,
      endDate: updated.challenge.endDate,
      joinedAt: updated.joinedAt,
      completed: updated.completed,
      completedAt: updated.completedAt,
      daysRemaining: Math.max(0, daysRemaining),
      isActive: updated.challenge.isActive,
    };
  }

  // Deactivate expired challenges (cron job)
  async deactivateExpiredChallenges(): Promise<number> {
    const result = await this.prisma.challenge.updateMany({
      where: {
        endDate: { lt: new Date() },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });
    return result.count;
  }
}
