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
}