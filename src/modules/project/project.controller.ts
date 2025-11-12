import {
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    HttpCode,
    HttpStatus
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiBody,
    ApiQuery
} from '@nestjs/swagger';
import { AuthGuard } from '../../core/common/guards/auth.guard';
import { ProjectService } from './project.service';
import { CreateProjectDto, ProjectResponseDto, UpdateProjectSettingsDto } from './dto/project.dto';
import { PaginationDto, PaginatedResponseDto, createPaginationMeta } from '../../core/common/dto/pagination.dto';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('/projects')
export class ProjectController {
    constructor(private readonly projectService: ProjectService) {}

    @Post()
    @ApiOperation({ summary: 'Create a new project (personal or team-based)' })
    @ApiBody({ type: CreateProjectDto })
    @ApiResponse({
        status: 201,
        description: 'Project created successfully',
        type: ProjectResponseDto
    })
    @ApiResponse({ status: 403, description: 'Insufficient privileges (ADMIN/OWNER required for team projects)' })
    @ApiResponse({ status: 404, description: 'Team not found' })
    @ApiResponse({ status: 409, description: 'Project name already exists' })
    async createProject(
        @Request() req: any,
        @Body() createProjectDto: CreateProjectDto
    ): Promise<ProjectResponseDto> {
        const project = await this.projectService.createProject(req.user.sub, createProjectDto);
        return {
            id: project.id,
            ownerId: project.ownerId,
            teamId: project.teamId,
            name: project.name,
            description: project.description,
            visibility: project.visibility as any,
            createdAt: project.createdAt
        };
    }

    @Get('by-team/:teamId')
    @ApiOperation({ summary: 'Get all projects in a team' })
    @ApiParam({ name: 'teamId', description: 'Team ID', example: '507f1f77bcf86cd799439011' })
    @ApiResponse({
        status: 200,
        description: 'List of projects in the team',
        type: [ProjectResponseDto]
    })
    @ApiResponse({ status: 403, description: 'Not a team member' })
    @ApiResponse({ status: 404, description: 'Team not found' })
    async getProjectsByTeam(
        @Request() req: any,
        @Param('teamId') teamId: string
    ): Promise<ProjectResponseDto[]> {
        return this.projectService.getProjectsByTeam(req.user.sub, teamId);
    }

    @Get('personal')
    @ApiOperation({ summary: 'Get all personal projects of the authenticated user' })
    @ApiResponse({
        status: 200,
        description: 'List of personal projects',
        type: [ProjectResponseDto]
    })
    async getPersonalProjects(@Request() req: any): Promise<ProjectResponseDto[]> {
        return this.projectService.getPersonalProjects(req.user.sub);
    }

    @Get('public')
    @ApiOperation({ summary: 'Get all public projects (paginated)' })
    @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)', example: 1 })
    @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 5, max: 100)', example: 5 })
    @ApiResponse({
        status: 200,
        description: 'List of public projects with pagination metadata',
        schema: {
            type: 'object',
            properties: {
                data: {
                    type: 'array',
                    items: { type: 'object' }
                },
                meta: {
                    type: 'object',
                    properties: {
                        page: { type: 'number', example: 1 },
                        limit: { type: 'number', example: 5 },
                        total: { type: 'number', example: 42 },
                        totalPages: { type: 'number', example: 9 },
                        hasNextPage: { type: 'boolean', example: true },
                        hasPreviousPage: { type: 'boolean', example: false }
                    }
                }
            }
        }
    })
    async getPublicProjects(@Query() paginationDto: PaginationDto) {
        try {
            console.log('DEBUG - Controller getPublicProjects: Starting with pagination', paginationDto);
            const { page = 1, limit = 5 } = paginationDto;
            const { data, total } = await this.projectService.getPublicProjects(page, limit);
            console.log('DEBUG - Controller getPublicProjects: Success, returning', data.length, 'of', total, 'projects');
            
            return {
                data,
                meta: createPaginationMeta(page, limit, total)
            };
        } catch (error) {
            console.error('DEBUG - Controller getPublicProjects error:', error);
            throw error;
        }
    }

    @Get(':projectId')
    @ApiOperation({ summary: 'Get a specific project by ID' })
    @ApiParam({ name: 'projectId', description: 'Project ID', example: '507f1f77bcf86cd799439012' })
    @ApiResponse({
        status: 200,
        description: 'Project details',
        type: ProjectResponseDto
    })
    @ApiResponse({ status: 403, description: 'Not a team member' })
    @ApiResponse({ status: 404, description: 'Project not found' })
    async getProjectById(
        @Request() req: any,
        @Param('projectId') projectId: string
    ): Promise<ProjectResponseDto> {
        return this.projectService.getProjectById(req.user.sub, projectId);
    }

    @Put(':projectId')
    @ApiOperation({ summary: 'Update a project' })
    @ApiParam({ name: 'projectId', description: 'Project ID', example: '507f1f77bcf86cd799439012' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                name: { type: 'string', example: 'Updated Project Name', maxLength: 100 },
                description: { type: 'string', example: 'Updated project description', maxLength: 500 }
            }
        }
    })
    @ApiResponse({
        status: 200,
        description: 'Project updated successfully',
        type: ProjectResponseDto
    })
    @ApiResponse({ status: 403, description: 'Insufficient privileges (ADMIN/OWNER required)' })
    @ApiResponse({ status: 404, description: 'Project not found' })
    @ApiResponse({ status: 409, description: 'Project name already exists in team' })
    async updateProject(
        @Request() req: any,
        @Param('projectId') projectId: string,
        @Body() updateData: Partial<Pick<CreateProjectDto, 'name' | 'description'>>
    ) {
        return this.projectService.updateProject(req.user.sub, projectId, updateData);
    }

    @Patch(':projectId/settings')
    @ApiOperation({ summary: 'Update project settings (visibility, team attachment)' })
    @ApiParam({ name: 'projectId', description: 'Project ID', example: '507f1f77bcf86cd799439012' })
    @ApiBody({ type: UpdateProjectSettingsDto })
    @ApiResponse({
        status: 200,
        description: 'Project settings updated successfully',
        type: ProjectResponseDto
    })
    @ApiResponse({ status: 403, description: 'Insufficient privileges (Owner or team admin required)' })
    @ApiResponse({ status: 404, description: 'Project not found' })
    async updateProjectSettings(
        @Request() req: any,
        @Param('projectId') projectId: string,
        @Body() updateData: UpdateProjectSettingsDto
    ) {
        const project = await this.projectService.updateProjectSettings(req.user.sub, projectId, updateData);
        return {
            id: project.id,
            ownerId: project.ownerId,
            teamId: project.teamId,
            name: project.name,
            description: project.description,
            visibility: project.visibility as any,
            createdAt: project.createdAt
        };
    }

    @Post(':projectId/invite')
    @ApiOperation({ summary: 'Invite member to project (delegates to team invitation if project has team)' })
    @ApiParam({ name: 'projectId', description: 'Project ID', example: '507f1f77bcf86cd799439012' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                email: { type: 'string', example: 'user@example.com' },
                role: { type: 'string', enum: ['ADMIN', 'MEMBER'], example: 'MEMBER' }
            },
            required: ['email']
        }
    })
    @ApiResponse({
        status: 200,
        description: 'Invitation sent successfully'
    })
    @ApiResponse({ status: 400, description: 'Project has no team attached' })
    @ApiResponse({ status: 403, description: 'Insufficient privileges' })
    @ApiResponse({ status: 404, description: 'Project not found' })
    async inviteProjectMember(
        @Request() req: any,
        @Param('projectId') projectId: string,
        @Body() inviteData: { email: string; role?: string }
    ) {
        return this.projectService.inviteProjectMember(req.user.sub, projectId, inviteData);
    }

    @Delete(':projectId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Delete a project' })
    @ApiParam({ name: 'projectId', description: 'Project ID', example: '507f1f77bcf86cd799439012' })
    @ApiResponse({
        status: 200,
        description: 'Project deleted successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Project deleted successfully' }
            }
        }
    })
    @ApiResponse({ status: 403, description: 'Insufficient privileges (Owner or team admin required)' })
    @ApiResponse({ status: 404, description: 'Project not found' })
    async deleteProject(
        @Request() req: any,
        @Param('projectId') projectId: string
    ) {
        return this.projectService.deleteProject(req.user.sub, projectId);
    }
}