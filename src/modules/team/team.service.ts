import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { Team, TeamMember, TeamInvite, User, TeamRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../core/services/prisma.service';
import { CreateTeamDto, InviteDto, AcceptInviteDto, TeamResponseDto, InviteResponseDto } from './dto/team.dto';
import { TeamAccessService } from './team-access.service';
import { EmailTemplate, EmailSubject } from '../../core/constants/email.constants';

@Injectable()
export class TeamService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly teamAccessService: TeamAccessService,
        private readonly configService: ConfigService,
        private readonly mailerService: MailerService
    ) {}

    /**
     * Create a new team with the requesting user as OWNER
     */
    async createTeam(userId: string, createTeamDto: CreateTeamDto): Promise<Team> {
        // Check if team name already exists for this user (optional business rule)
        const existingTeam = await this.prismaService.team.findFirst({
            where: {
                name: createTeamDto.name,
                members: {
                    some: {
                        userId: userId
                    }
                }
            }
        });

        if (existingTeam) {
            throw new ConflictException('You already have a team with this name');
        }

        // Create team and add creator as OWNER in a transaction
        const result = await this.prismaService.$transaction(async (prisma) => {
            const team = await prisma.team.create({
                data: {
                    name: createTeamDto.name,
                    description: createTeamDto.description
                }
            });

            await prisma.teamMember.create({
                data: {
                    teamId: team.id,
                    userId: userId,
                    role: TeamRole.OWNER
                }
            });

            return team;
        });

        return result;
    }

    /**
     * Get all teams where the user is a member
     */
    async getMyTeams(userId: string): Promise<TeamResponseDto[]> {
        const teams = await this.prismaService.team.findMany({
            where: {
                members: {
                    some: {
                        userId: userId
                    }
                }
            },
            include: {
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    },
                    orderBy: [
                        { role: 'asc' }, // OWNER first, then ADMIN, then MEMBER
                        { joinedAt: 'asc' }
                    ]
                },
                projects: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        createdAt: true
                    },
                    orderBy: {
                        createdAt: 'desc'
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return teams.map(team => ({
            id: team.id,
            name: team.name,
            description: team.description,
            createdAt: team.createdAt,
            members: team.members.map(member => ({
                id: member.user.id,
                name: member.user.name,
                email: member.user.email,
                role: member.role,
                joinedAt: member.joinedAt
            })),
            projects: team.projects
        }));
    }

    /**
     * Invite a user to join a team
     */
    async inviteUser(userId: string, teamId: string, inviteDto: InviteDto): Promise<InviteResponseDto> {
        // Check if user has admin privileges
        await this.teamAccessService.assertAdmin(userId, teamId);

        // Check if team exists
        const team = await this.prismaService.team.findUnique({
            where: { id: teamId }
        });

        if (!team) {
            throw new NotFoundException('Team not found');
        }

        // Check if user is already a member
        const existingMember = await this.prismaService.teamMember.findUnique({
            where: {
                teamId_userId: {
                    teamId,
                    userId: await this.getUserIdByEmail(inviteDto.email)
                }
            }
        });

        if (existingMember) {
            throw new ConflictException('User is already a member of this team');
        }

        // Clean up old invites and check for existing pending invite
        const now = new Date();
        
        // Delete expired invites for this email and team
        await this.prismaService.teamInvite.deleteMany({
            where: {
                teamId,
                email: inviteDto.email,
                acceptedAt: null,
                expiresAt: {
                    lt: now
                }
            }
        });

        // Check for existing pending invite
        const existingInvite = await this.prismaService.teamInvite.findFirst({
            where: {
                teamId,
                email: inviteDto.email,
                acceptedAt: null,
                expiresAt: {
                    gt: now
                }
            }
        });

        if (existingInvite) {
            // Return the existing invite instead of creating a new one
            const response: InviteResponseDto = {
                message: 'Invitation already exists and is still valid'
            };

            // Show token in development environment
            if (this.configService.get('NODE_ENV') !== 'production') {
                response.token = existingInvite.token;
            }

            return response;
        }

        // Generate unique token
        const token = this.generateInviteToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiration (extended for better UX)

        // Create invite
        const invite = await this.prismaService.teamInvite.create({
            data: {
                teamId,
                email: inviteDto.email,
                token,
                role: inviteDto.role || TeamRole.MEMBER,
                expiresAt
            }
        });

        // Get inviter details for email context
        const inviter = await this.prismaService.user.findUnique({
            where: { id: userId },
            select: { name: true, email: true }
        });

        // Send invitation email
        try {
            await this.sendInvitationEmail(
                inviteDto.email,
                team.name,
                team.description,
                token,
                inviteDto.role || TeamRole.MEMBER,
                expiresAt,
                inviter?.name || 'Unknown User',
                inviter?.email || 'unknown@example.com'
            );
        } catch (error) {
            console.error('Failed to send invitation email:', error);
            // Don't fail the invitation if email fails - the invitation is still created
        }

        const response: InviteResponseDto = {
            message: 'Invitation sent successfully'
        };

        // Show token in development environment
        if (this.configService.get('NODE_ENV') !== 'production') {
            response.token = token;
        }

        return response;
    }

    /**
     * Accept a team invitation
     */
    async acceptInvite(userId: string, acceptInviteDto: AcceptInviteDto): Promise<{ message: string; team: Team }> {
        // Find the invitation
        const invite = await this.prismaService.teamInvite.findUnique({
            where: {
                token: acceptInviteDto.token
            },
            include: {
                team: true
            }
        });

        if (!invite) {
            throw new NotFoundException('Invalid invitation token');
        }

        if (invite.acceptedAt) {
            throw new BadRequestException(`Invitation has already been accepted on ${invite.acceptedAt.toISOString()}`);
        }

        const now = new Date();
        if (invite.expiresAt < now) {
            const expiredHoursAgo = Math.floor((now.getTime() - invite.expiresAt.getTime()) / (1000 * 60 * 60));
            throw new BadRequestException(`Invitation expired ${expiredHoursAgo} hours ago (expired: ${invite.expiresAt.toISOString()}, now: ${now.toISOString()})`);
        }

        // Get user email to verify
        const user = await this.prismaService.user.findUnique({
            where: { id: userId },
            select: { email: true }
        });

        if (!user || user.email !== invite.email) {
            throw new BadRequestException('Invitation is not for this user');
        }

        // Check if user is already a member
        const existingMember = await this.prismaService.teamMember.findUnique({
            where: {
                teamId_userId: {
                    teamId: invite.teamId,
                    userId
                }
            }
        });

        if (existingMember) {
            throw new ConflictException('You are already a member of this team');
        }

        // Accept invitation in a transaction
        const result = await this.prismaService.$transaction(async (prisma) => {
            // Add user to team
            await prisma.teamMember.create({
                data: {
                    teamId: invite.teamId,
                    userId,
                    role: invite.role
                }
            });

            // Mark invitation as accepted
            await prisma.teamInvite.update({
                where: { id: invite.id },
                data: { acceptedAt: new Date() }
            });

            return invite.team;
        });

        return {
            message: 'Successfully joined the team',
            team: result
        };
    }

    /**
     * Remove a member from a team
     */
    async removeMember(userId: string, teamId: string, targetUserId: string): Promise<{ message: string }> {
        console.log('DEBUG - removeMember service:', { userId, teamId, targetUserId });
        // Check if user has admin privileges
        await this.teamAccessService.assertAdmin(userId, teamId);

        // Cannot remove yourself if you're the only owner
        if (userId === targetUserId) {
            const ownerCount = await this.prismaService.teamMember.count({
                where: {
                    teamId,
                    role: TeamRole.OWNER
                }
            });

            if (ownerCount === 1) {
                throw new BadRequestException('Cannot remove the only owner of the team');
            }
        }

        // Check if target user is a member
        const targetMember = await this.prismaService.teamMember.findUnique({
            where: {
                teamId_userId: {
                    teamId,
                    userId: targetUserId
                }
            }
        });

        if (!targetMember) {
            throw new NotFoundException('User is not a member of this team');
        }

        // Remove the member
        await this.prismaService.teamMember.delete({
            where: {
                teamId_userId: {
                    teamId,
                    userId: targetUserId
                }
            }
        });

        return { message: 'Member removed successfully' };
    }

    /**
     * Helper method to get user ID by email
     */
    private async getUserIdByEmail(email: string): Promise<string> {
        const user = await this.prismaService.user.findUnique({
            where: { email },
            select: { id: true }
        });

        return user?.id || '';
    }

    /**
     * Generate a secure random token for invitations
     */
    private generateInviteToken(): string {
        const isDevelopment = this.configService.get('NODE_ENV') === 'development';
        
        if (isDevelopment) {
            // In development, create a longer token for easier testing
            return randomBytes(64).toString('hex');
        } else {
            // In production, use standard 32-byte token
            return randomBytes(32).toString('hex');
        }
    }

    /**
     * Send team invitation email
     */
    private async sendInvitationEmail(
        email: string,
        teamName: string,
        teamDescription: string | null,
        token: string,
        role: TeamRole,
        expirationDate: Date,
        inviterName: string,
        inviterEmail: string
    ): Promise<void> {
        const baseUrl = this.configService.get<string>('BASE_URL', 'http://localhost:3000');
        const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
        
        // Generate direct acceptance URL - matches the frontend route structure
        const acceptUrl = `${frontendUrl}/teams/invite/accept/${token}`;
        
        await this.mailerService.sendMail({
            to: email,
            subject: EmailSubject.TEAM_INVITATION,
            template: EmailTemplate.TEAM_INVITATION,
            context: {
                teamName,
                teamDescription,
                token,
                role,
                acceptUrl,
                expirationDate: expirationDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                inviterName,
                inviterEmail,
                baseUrl
            }
        });
    }

    /**
     * Leave a team (member leaves voluntarily)
     */
    async leaveTeam(userId: string, teamId: string): Promise<{ message: string }> {
        // Find the team and user's membership
        const team = await this.prismaService.team.findUnique({
            where: { id: teamId },
            include: {
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    }
                }
            }
        });

        if (!team) {
            throw new NotFoundException('Team not found');
        }

        // Find user's membership
        const userMembership = team.members.find(member => member.userId === userId);
        if (!userMembership) {
            throw new NotFoundException('You are not a member of this team');
        }

        // Check if user is the only owner
        const owners = team.members.filter(member => member.role === TeamRole.OWNER);
        if (userMembership.role === TeamRole.OWNER && owners.length === 1) {
            throw new BadRequestException('Cannot leave team - you are the only owner. Transfer ownership first or delete the team.');
        }

        // Remove the membership
        await this.prismaService.teamMember.delete({
            where: { id: userMembership.id }
        });

        return { message: 'Successfully left the team' };
    }

    /**
     * Update team settings (name, description)
     */
    async updateTeamSettings(userId: string, teamId: string, updateData: { name?: string; description?: string }): Promise<TeamResponseDto> {
        // Check if user has admin privileges
        await this.teamAccessService.assertAdmin(userId, teamId);

        // Validate if name already exists (if name is being updated)
        if (updateData.name) {
            const existingTeam = await this.prismaService.team.findFirst({
                where: {
                    name: updateData.name,
                    id: { not: teamId }, // Exclude current team
                    members: {
                        some: {
                            userId: userId
                        }
                    }
                }
            });

            if (existingTeam) {
                throw new ConflictException('You already have a team with this name');
            }
        }

        // Update team
        const updatedTeam = await this.prismaService.team.update({
            where: { id: teamId },
            data: updateData,
            include: {
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    }
                },
                projects: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        visibility: true,
                        createdAt: true
                    }
                }
            }
        });

        return {
            id: updatedTeam.id,
            name: updatedTeam.name,
            description: updatedTeam.description,
            createdAt: updatedTeam.createdAt,
            members: updatedTeam.members.map(member => ({
                id: member.id,
                name: member.user.name,
                email: member.user.email,
                role: member.role,
                joinedAt: member.joinedAt
            })),
            projects: updatedTeam.projects
        };
    }

    /**
     * Get team activity dashboard data
     */
    async getTeamActivity(userId: string, teamId: string) {
        // Check if user is a team member
        await this.teamAccessService.assertMember(userId, teamId);

        // Get team with members for querying tasks
        const team = await this.prismaService.team.findUnique({
            where: { id: teamId },
            include: {
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    }
                },
                projects: {
                    select: {
                        id: true,
                        name: true,
                        _count: {
                            select: {
                                tasks: true
                            }
                        }
                    }
                }
            }
        });

        if (!team) {
            throw new NotFoundException('Team not found');
        }

        const memberIds = team.members.map(member => member.userId);

        // Get recent tasks from team members (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentTasks = await this.prismaService.task.findMany({
            where: {
                userId: { in: memberIds },
                OR: [
                    { createdAt: { gte: thirtyDaysAgo } },
                    { updatedAt: { gte: thirtyDaysAgo } }
                ]
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                project: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: { updatedAt: 'desc' },
            take: 20
        });

        // Get member statistics
        const memberStats = await Promise.all(
            team.members.map(async (member) => {
                const [totalTasks, completedTasks, inProgressTasks] = await Promise.all([
                    this.prismaService.task.count({
                        where: { userId: member.userId }
                    }),
                    this.prismaService.task.count({
                        where: { 
                            userId: member.userId,
                            status: 'DONE'
                        }
                    }),
                    this.prismaService.task.count({
                        where: { 
                            userId: member.userId,
                            status: 'IN_PROGRESS'
                        }
                    })
                ]);

                return {
                    userId: member.userId,
                    name: member.user.name,
                    email: member.user.email,
                    role: member.role,
                    totalTasks,
                    completedTasks,
                    inProgressTasks,
                    completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
                };
            })
        );

        // Project statistics
        const projectStats = team.projects.map(project => ({
            id: project.id,
            name: project.name,
            taskCount: project._count.tasks
        }));

        return {
            recentTasks: recentTasks.map(task => ({
                id: task.id,
                title: task.title,
                status: task.status,
                priority: task.priority,
                createdAt: task.createdAt,
                updatedAt: task.updatedAt,
                user: task.user,
                project: task.project
            })),
            memberStats,
            projectStats,
            teamSummary: {
                totalMembers: team.members.length,
                totalProjects: team.projects.length,
                totalTasks: memberStats.reduce((sum, member) => sum + member.totalTasks, 0),
                completedTasks: memberStats.reduce((sum, member) => sum + member.completedTasks, 0)
            }
        };
    }

    /**
     * Update a team member's role (only owners can do this)
     */
    async updateMemberRole(
        userId: string, 
        teamId: string, 
        memberId: string, 
        newRole: 'ADMIN' | 'MEMBER'
    ): Promise<{ message: string; member: any }> {
        // Verify that the requesting user is the team owner
        const requesterMembership = await this.prismaService.teamMember.findFirst({
            where: {
                teamId: teamId,
                userId: userId
            }
        });
        
        if (!requesterMembership || requesterMembership.role !== 'OWNER') {
            throw new BadRequestException('Only team owners can update member roles');
        }

        // Find the member to update - try by memberId first, then by userId
        let targetMember = await this.prismaService.teamMember.findFirst({
            where: {
                id: memberId,
                teamId: teamId
            },
            include: {
                user: true
            }
        });

        // If not found by teamMember.id, try by userId
        if (!targetMember) {
            targetMember = await this.prismaService.teamMember.findFirst({
                where: {
                    userId: memberId,
                    teamId: teamId
                },
                include: {
                    user: true
                }
            });
        }

        if (!targetMember) {
            throw new NotFoundException('Member not found in this team');
        }

        // Cannot change role of the team owner
        if (targetMember.role === 'OWNER') {
            throw new BadRequestException('Cannot change the role of the team owner');
        }

        // Update the member's role using the actual teamMember.id
        const updatedMember = await this.prismaService.teamMember.update({
            where: {
                id: targetMember.id
            },
            data: {
                role: newRole as TeamRole
            },
            include: {
                user: true
            }
        });

        return {
            message: 'Member role updated successfully',
            member: {
                id: updatedMember.id,
                role: updatedMember.role,
                name: updatedMember.user.name,
                email: updatedMember.user.email
            }
        };
    }
}