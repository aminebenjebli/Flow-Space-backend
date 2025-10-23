import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TeamRole } from '@prisma/client';
import { PrismaService } from '../../core/services/prisma.service';

@Injectable()
export class TeamAccessService {
    constructor(private readonly prismaService: PrismaService) {}

    /**
     * Assert that a user is a member of a specific team
     * @param userId - The user ID to check
     * @param teamId - The team ID to check membership for
     * @throws ForbiddenException if user is not a member
     */
    async assertMember(userId: string, teamId: string): Promise<void> {
        const membership = await this.prismaService.teamMember.findUnique({
            where: {
                teamId_userId: {
                    teamId,
                    userId
                }
            }
        });

        if (!membership) {
            throw new ForbiddenException('You are not a member of this team');
        }
    }

    /**
     * Assert that a user has admin privileges (OWNER or ADMIN) in a specific team
     * @param userId - The user ID to check
     * @param teamId - The team ID to check admin privileges for
     * @throws ForbiddenException if user is not an admin
     */
    async assertAdmin(userId: string, teamId: string): Promise<void> {
        const membership = await this.prismaService.teamMember.findUnique({
            where: {
                teamId_userId: {
                    teamId,
                    userId
                }
            }
        });

        if (!membership) {
            throw new ForbiddenException('You are not a member of this team');
        }

        if (membership.role !== TeamRole.OWNER && membership.role !== TeamRole.ADMIN) {
            throw new ForbiddenException('You need admin privileges to perform this action');
        }
    }

    /**
     * Get the team ID from a project ID
     * @param projectId - The project ID to get the team for
     * @returns The team ID
     * @throws NotFoundException if project doesn't exist
     */
    async getTeamIdFromProject(projectId: string): Promise<string> {
        const project = await this.prismaService.project.findUnique({
            where: { id: projectId },
            select: { teamId: true }
        });

        if (!project) {
            throw new NotFoundException('Project not found');
        }

        return project.teamId;
    }

    /**
     * Check if user is a member of a team (returns boolean instead of throwing)
     * @param userId - The user ID to check
     * @param teamId - The team ID to check membership for
     * @returns true if user is a member, false otherwise
     */
    async isMember(userId: string, teamId: string): Promise<boolean> {
        const membership = await this.prismaService.teamMember.findUnique({
            where: {
                teamId_userId: {
                    teamId,
                    userId
                }
            }
        });

        return !!membership;
    }

    /**
     * Check if user has admin privileges in a team (returns boolean instead of throwing)
     * @param userId - The user ID to check
     * @param teamId - The team ID to check admin privileges for
     * @returns true if user is admin, false otherwise
     */
    async isAdmin(userId: string, teamId: string): Promise<boolean> {
        const membership = await this.prismaService.teamMember.findUnique({
            where: {
                teamId_userId: {
                    teamId,
                    userId
                }
            }
        });

        return membership && (membership.role === TeamRole.OWNER || membership.role === TeamRole.ADMIN);
    }

    /**
     * Get user's role in a team
     * @param userId - The user ID to check
     * @param teamId - The team ID to check role for
     * @returns The user's role or null if not a member
     */
    async getUserRole(userId: string, teamId: string): Promise<TeamRole | null> {
        const membership = await this.prismaService.teamMember.findUnique({
            where: {
                teamId_userId: {
                    teamId,
                    userId
                }
            },
            select: { role: true }
        });

        return membership?.role || null;
    }
}