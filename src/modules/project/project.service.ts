import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Project, ProjectVisibility as PrismaProjectVisibility } from '@prisma/client';
import { PrismaService } from '../../core/services/prisma.service';
import { TeamAccessService } from '../team/team-access.service';
import { CreateProjectDto, ProjectResponseDto, UpdateProjectSettingsDto, ProjectVisibility } from './dto/project.dto';

@Injectable()
export class ProjectService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly teamAccessService: TeamAccessService
    ) {}

    /**
     * Create a new project (personal or team-based)
     */
    async createProject(userId: string, createProjectDto: CreateProjectDto): Promise<Project> {
        // If teamId is provided, check if user has admin privileges in the team
        if (createProjectDto.teamId) {
            await this.teamAccessService.assertAdmin(userId, createProjectDto.teamId);

            // Check if team exists
            const team = await this.prismaService.team.findUnique({
                where: { id: createProjectDto.teamId }
            });

            if (!team) {
                throw new NotFoundException('Team not found');
            }
        }

        // Check if project name already exists for this owner
        const existingProject = await this.prismaService.project.findUnique({
            where: {
                ownerId_name: {
                    ownerId: userId,
                    name: createProjectDto.name
                }
            }
        });

        if (existingProject) {
            throw new ConflictException('A project with this name already exists');
        }

        // Create the project
        const project = await this.prismaService.project.create({
            data: {
                ownerId: userId,
                teamId: createProjectDto.teamId || null,
                name: createProjectDto.name,
                description: createProjectDto.description,
                visibility: createProjectDto.visibility || 'PRIVATE'
            },
            include: {
                owner: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                team: createProjectDto.teamId ? {
                    select: {
                        id: true,
                        name: true,
                        description: true
                    }
                } : false
            }
        });

        return project;
    }

    /**
     * Get all projects in a team
     */
    async getProjectsByTeam(userId: string, teamId: string): Promise<ProjectResponseDto[]> {
        // Check if user is a member of the team
        await this.teamAccessService.assertMember(userId, teamId);

        // Check if team exists
        const team = await this.prismaService.team.findUnique({
            where: { id: teamId }
        });

        if (!team) {
            throw new NotFoundException('Team not found');
        }

        // Get projects with task counts
        const projects = await this.prismaService.project.findMany({
            where: {
                teamId: teamId
            },
            include: {
                owner: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                team: {
                    select: {
                        id: true,
                        name: true,
                        description: true
                    }
                },
                _count: {
                    select: {
                        tasks: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return projects.map(project => ({
            id: project.id,
            ownerId: project.ownerId,
            teamId: project.teamId,
            name: project.name,
            description: project.description,
            visibility: project.visibility as ProjectVisibility,
            createdAt: project.createdAt,
            owner: project.owner ? {
                id: project.owner.id,
                name: project.owner.name,
                email: project.owner.email
            } : undefined,
            team: project.team,
            taskCount: project._count.tasks
        }));
    }

    /**
     * Get all personal projects of a user (projects without team)
     */
    async getPersonalProjects(userId: string): Promise<ProjectResponseDto[]> {
        const projects = await this.prismaService.project.findMany({
            where: {
                ownerId: userId,
                teamId: null // Personal projects have no team
            },
            include: {
                owner: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                _count: {
                    select: {
                        tasks: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return projects.map(project => ({
            id: project.id,
            ownerId: project.ownerId,
            teamId: project.teamId,
            name: project.name,
            description: project.description,
            visibility: project.visibility as ProjectVisibility,
            createdAt: project.createdAt,
            owner: project.owner ? {
                id: project.owner.id,
                name: project.owner.name,
                email: project.owner.email
            } : undefined,
            team: null, // Personal projects have no team
            taskCount: project._count.tasks
        }));
    }

    /**
     * Get a single project by ID (with team membership check)
     */
    async getProjectById(userId: string, projectId: string): Promise<ProjectResponseDto> {
        // First get the project to check access
        const project = await this.prismaService.project.findUnique({
            where: { id: projectId },
            include: {
                owner: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                team: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        members: {
                            where: { userId: userId },
                            select: {
                                role: true
                            }
                        }
                    }
                },
                _count: {
                    select: {
                        tasks: true
                    }
                }
            }
        });

        if (!project) {
            throw new NotFoundException('Project not found');
        }

        // Check access permissions
        const isOwner = project.ownerId === userId;
        const isTeamMember = project.team?.members?.length > 0;
        const isPublic = project.visibility === 'PUBLIC';

        if (!isOwner && !isTeamMember && !isPublic) {
            throw new ForbiddenException('Access denied to this project');
        }

        return {
            id: project.id,
            ownerId: project.ownerId,
            teamId: project.teamId,
            name: project.name,
            description: project.description,
            visibility: project.visibility as ProjectVisibility,
            createdAt: project.createdAt,
            owner: project.owner ? {
                id: project.owner.id,
                name: project.owner.name,
                email: project.owner.email
            } : undefined,
            team: project.team ? {
                id: project.team.id,
                name: project.team.name,
                description: project.team.description
            } : null,
            taskCount: project._count.tasks
        };
    }

    /**
     * Update a project (admin only)
     */
    async updateProject(
        userId: string,
        projectId: string,
        updateData: Partial<Pick<CreateProjectDto, 'name' | 'description'>>
    ): Promise<Project> {
        // First get the project to check which team it belongs to
        const project = await this.prismaService.project.findUnique({
            where: { id: projectId }
        });

        if (!project) {
            throw new NotFoundException('Project not found');
        }

        // Check if user has admin privileges in the team
        await this.teamAccessService.assertAdmin(userId, project.teamId);

        // If name is being updated, check for conflicts
        if (updateData.name && updateData.name !== project.name) {
            const existingProject = await this.prismaService.project.findUnique({
                where: {
                    ownerId_name: {
                        ownerId: project.ownerId,
                        name: updateData.name
                    }
                }
            });

            if (existingProject) {
                throw new ConflictException('A project with this name already exists');
            }
        }

        // Update the project
        return this.prismaService.project.update({
            where: { id: projectId },
            data: updateData,
            include: {
                team: {
                    select: {
                        id: true,
                        name: true,
                        description: true
                    }
                }
            }
        });
    }

    /**
     * Update project settings (owner or team admin only)
     */
    async updateProjectSettings(userId: string, projectId: string, updateData: UpdateProjectSettingsDto): Promise<Project> {
        // First get the project to check permissions
        const project = await this.prismaService.project.findUnique({
            where: { id: projectId },
            include: {
                team: {
                    include: {
                        members: {
                            where: { userId: userId },
                            select: { role: true }
                        }
                    }
                }
            }
        });

        if (!project) {
            throw new NotFoundException('Project not found');
        }

        // Check permissions: owner or team admin
        const isOwner = project.ownerId === userId;
        const isTeamAdmin = project.team?.members?.[0]?.role === 'OWNER' || project.team?.members?.[0]?.role === 'ADMIN';

        if (!isOwner && !isTeamAdmin) {
            throw new ForbiddenException('Only project owner or team admin can update settings');
        }

        // If changing team attachment, validate
        if (updateData.teamId !== undefined) {
            if (updateData.teamId) {
                // Attaching to a team - check if user is admin of that team
                await this.teamAccessService.assertAdmin(userId, updateData.teamId);
            }
            // If teamId is null, we're detaching (no additional validation needed)
        }

        // Update the project
        return this.prismaService.project.update({
            where: { id: projectId },
            data: {
                ...(updateData.visibility && { visibility: updateData.visibility }),
                ...(updateData.teamId !== undefined && { teamId: updateData.teamId })
            },
            include: {
                owner: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                team: updateData.teamId ? {
                    select: {
                        id: true,
                        name: true,
                        description: true
                    }
                } : false
            }
        });
    }

    /**
     * Invite member to project (delegates to team invitation)
     */
    async inviteProjectMember(userId: string, projectId: string, inviteData: { email: string; role?: string }): Promise<any> {
        // Get the project
        const project = await this.prismaService.project.findUnique({
            where: { id: projectId },
            include: {
                team: {
                    include: {
                        members: {
                            where: { userId: userId },
                            select: { role: true }
                        }
                    }
                }
            }
        });

        if (!project) {
            throw new NotFoundException('Project not found');
        }

        if (!project.teamId) {
            throw new ConflictException('Cannot invite members to personal projects. Attach the project to a team first.');
        }

        // Check permissions: owner or team admin
        const isOwner = project.ownerId === userId;
        const isTeamAdmin = project.team?.members?.[0]?.role === 'OWNER' || project.team?.members?.[0]?.role === 'ADMIN';

        if (!isOwner && !isTeamAdmin) {
            throw new ForbiddenException('Only project owner or team admin can invite members');
        }

        // Delegate to team service for invitation
        // For now, return a placeholder - you'll need to inject TeamService or create the invite directly
        const teamInvite = await this.prismaService.teamInvite.create({
            data: {
                teamId: project.teamId,
                email: inviteData.email,
                role: (inviteData.role as any) || 'MEMBER',
                token: this.generateInviteToken(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            }
        });

        return {
            id: teamInvite.id,
            email: teamInvite.email,
            role: teamInvite.role,
            token: teamInvite.token,
            expiresAt: teamInvite.expiresAt
        };
    }

    private generateInviteToken(): string {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    /**
     * Delete a project (owner or team admin only)
     */
    async deleteProject(userId: string, projectId: string): Promise<{ message: string }> {
        // First get the project to check permissions
        const project = await this.prismaService.project.findUnique({
            where: { id: projectId },
            include: {
                team: {
                    include: {
                        members: {
                            where: { userId: userId },
                            select: { role: true }
                        }
                    }
                }
            }
        });

        if (!project) {
            throw new NotFoundException('Project not found');
        }

        // Check permissions: owner or team admin
        const isOwner = project.ownerId === userId;
        const isTeamAdmin = project.team?.members?.[0]?.role === 'OWNER' || project.team?.members?.[0]?.role === 'ADMIN';

        if (!isOwner && !isTeamAdmin) {
            throw new ForbiddenException('Only project owner or team admin can delete project');
        }

        // Delete the project (tasks will be set to null due to onDelete: SetNull)
        await this.prismaService.project.delete({
            where: { id: projectId }
        });

        return { message: 'Project deleted successfully' };
    }

    /**
     * Get all public projects across all teams
     */
    async getPublicProjects(): Promise<ProjectResponseDto[]> {
        try {
            console.log('DEBUG - getPublicProjects: Starting query for public projects');
            
            // First check if we can access the database
            const projectCount = await this.prismaService.project.count();
            console.log('DEBUG - Total projects in database:', projectCount);
            
            const publicProjects = await this.prismaService.project.findMany({
                where: {
                    visibility: PrismaProjectVisibility.PUBLIC
                },
                include: {
                    owner: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    },
                    team: {
                        select: {
                            id: true,
                            name: true,
                            description: true
                        }
                    },
                    _count: {
                        select: {
                            tasks: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });

            console.log('DEBUG - getPublicProjects: Found', publicProjects.length, 'public projects');
            
            return publicProjects.map(project => ({
                id: project.id,
                ownerId: project.ownerId,
                teamId: project.teamId,
                name: project.name,
                description: project.description,
                visibility: project.visibility as ProjectVisibility,
                createdAt: project.createdAt,
                owner: project.owner ? {
                    id: project.owner.id,
                    name: project.owner.name,
                    email: project.owner.email
                } : undefined,
                team: project.team ? {
                    id: project.team.id,
                    name: project.team.name,
                    description: project.team.description
                } : null,
                taskCount: project._count.tasks
            }));
            
        } catch (error) {
            console.error('DEBUG - getPublicProjects error:', error);
            console.error('DEBUG - Error stack:', error.stack);
            throw error;
        }
    }
}