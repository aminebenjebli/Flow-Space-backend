import {
    Controller,
    Get,
    Post,
    Put,
    Body,
    Param,
    UseGuards,
    Request,
    HttpCode,
    HttpStatus,
    Res
} from '@nestjs/common';
import { Response } from 'express';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiBody
} from '@nestjs/swagger';
import { AuthGuard } from '../../core/common/guards/auth.guard';
import { TeamService } from './team.service';
import {
    CreateTeamDto,
    InviteDto,
    AcceptInviteDto,
    TeamResponseDto,
    InviteResponseDto
} from './dto/team.dto';

@ApiTags('Teams')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('/teams')
export class TeamController {
    constructor(private readonly teamService: TeamService) {}

    @Post()
    @ApiOperation({ summary: 'Create a new team' })
    @ApiBody({ type: CreateTeamDto })
    @ApiResponse({
        status: 201,
        description: 'Team created successfully',
        schema: {
            type: 'object',
            properties: {
                id: { type: 'string', example: '507f1f77bcf86cd799439011' },
                name: { type: 'string', example: 'Development Team' },
                description: { type: 'string', example: 'Main development team' },
                createdAt: { type: 'string', format: 'date-time' }
            }
        }
    })
    @ApiResponse({ status: 400, description: 'Invalid input data' })
    @ApiResponse({ status: 409, description: 'Team name already exists' })
    async createTeam(@Request() req: any, @Body() createTeamDto: CreateTeamDto) {
        return this.teamService.createTeam(req.user.sub, createTeamDto);
    }

    @Get('mine')
    @ApiOperation({ summary: 'Get my teams with members and projects' })
    @ApiResponse({
        status: 200,
        description: 'List of user teams',
        type: [TeamResponseDto]
    })
    async getMyTeams(@Request() req: any): Promise<TeamResponseDto[]> {
        return this.teamService.getMyTeams(req.user.sub);
    }

    @Post(':teamId/invites')
    @ApiOperation({ summary: 'Invite a user to join the team' })
    @ApiParam({ name: 'teamId', description: 'Team ID', example: '507f1f77bcf86cd799439011' })
    @ApiBody({ type: InviteDto })
    @ApiResponse({
        status: 201,
        description: 'Invitation sent successfully',
        type: InviteResponseDto
    })
    @ApiResponse({ status: 403, description: 'Insufficient privileges (ADMIN/OWNER required)' })
    @ApiResponse({ status: 404, description: 'Team not found' })
    @ApiResponse({ status: 409, description: 'User already member or invitation exists' })
    async inviteUser(
        @Request() req: any,
        @Param('teamId') teamId: string,
        @Body() inviteDto: InviteDto
    ): Promise<InviteResponseDto> {
        return this.teamService.inviteUser(req.user.sub, teamId, inviteDto);
    }

    @Post('accept-invite')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Accept a team invitation' })
    @ApiBody({ type: AcceptInviteDto })
    @ApiResponse({
        status: 200,
        description: 'Successfully joined the team',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Successfully joined the team' },
                team: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', example: '507f1f77bcf86cd799439011' },
                        name: { type: 'string', example: 'Development Team' },
                        description: { type: 'string', example: 'Main development team' },
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                }
            }
        }
    })
    @ApiResponse({ status: 400, description: 'Invalid or expired token, or invitation not for this user' })
    @ApiResponse({ status: 404, description: 'Invitation not found' })
    @ApiResponse({ status: 409, description: 'Already a member or invitation already accepted' })
    async acceptInvite(
        @Request() req: any,
        @Body() acceptInviteDto: AcceptInviteDto
    ) {
        return this.teamService.acceptInvite(req.user.sub, acceptInviteDto);
    }
    @Post(':teamId/remove/:userId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Remove a member from the team' })
    @ApiParam({ name: 'teamId', description: 'Team ID', example: '507f1f77bcf86cd799439011' })
    @ApiParam({ name: 'userId', description: 'User ID to remove', example: '507f1f77bcf86cd799439012' })
    @ApiResponse({
        status: 200,
        description: 'Member removed successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Member removed successfully' }
            }
        }
    })
    @ApiResponse({ status: 400, description: 'Cannot remove only owner' })
    @ApiResponse({ status: 403, description: 'Insufficient privileges (ADMIN/OWNER required)' })
    @ApiResponse({ status: 404, description: 'Team or user not found' })
    async removeMember(
        @Request() req: any,
        @Param('teamId') teamId: string,
        @Param('userId') userId: string
    ) {
        console.log('DEBUG - removeMember controller:', { 
            requesterId: req.user.sub, 
            teamId, 
            targetUserId: userId,
            url: req.url 
        });
        return this.teamService.removeMember(req.user.sub, teamId, userId);
    }

    @Post(':teamId/leave')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Leave a team (member leaves voluntarily)' })
    @ApiParam({ name: 'teamId', description: 'Team ID', example: '507f1f77bcf86cd799439011' })
    @ApiResponse({
        status: 200,
        description: 'Successfully left the team',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Successfully left the team' }
            }
        }
    })
    @ApiResponse({ status: 400, description: 'Cannot leave - you are the only owner' })
    @ApiResponse({ status: 404, description: 'Team not found or not a member' })
    async leaveTeam(
        @Request() req: any,
        @Param('teamId') teamId: string
    ) {
        return this.teamService.leaveTeam(req.user.sub, teamId);
    }

    @Put(':teamId/settings')
    @ApiOperation({ summary: 'Update team settings (ADMIN/OWNER only)' })
    @ApiParam({ name: 'teamId', description: 'Team ID', example: '507f1f77bcf86cd799439011' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                name: { type: 'string', example: 'Updated Team Name' },
                description: { type: 'string', example: 'Updated description' }
            }
        }
    })
    @ApiResponse({
        status: 200,
        description: 'Team settings updated successfully',
        type: TeamResponseDto
    })
    @ApiResponse({ status: 403, description: 'Insufficient privileges (ADMIN/OWNER required)' })
    @ApiResponse({ status: 404, description: 'Team not found' })
    async updateTeamSettings(
        @Request() req: any,
        @Param('teamId') teamId: string,
        @Body() updateData: { name?: string; description?: string }
    ) {
        return this.teamService.updateTeamSettings(req.user.sub, teamId, updateData);
    }

    @Get(':teamId/activity')
    @ApiOperation({ summary: 'Get team activity dashboard data' })
    @ApiParam({ name: 'teamId', description: 'Team ID', example: '507f1f77bcf86cd799439011' })
    @ApiResponse({
        status: 200,
        description: 'Team activity data',
        schema: {
            type: 'object',
            properties: {
                recentTasks: {
                    type: 'array',
                    description: 'Recently created or updated tasks by team members'
                },
                memberStats: {
                    type: 'array',
                    description: 'Task statistics per team member'
                },
                projectStats: {
                    type: 'object',
                    description: 'Statistics per project'
                }
            }
        }
    })
    @ApiResponse({ status: 403, description: 'Not a team member' })
    @ApiResponse({ status: 404, description: 'Team not found' })
    async getTeamActivity(
        @Request() req: any,
        @Param('teamId') teamId: string
    ) {
        return this.teamService.getTeamActivity(req.user.sub, teamId);
    }

    @Get('invite/accept/:token')
    @ApiOperation({ summary: 'Accept team invitation via direct link (GET) - Redirects to frontend' })
    @ApiParam({ name: 'token', description: 'Invitation token', example: 'abc123def456...' })
    @ApiResponse({ status: 302, description: 'Redirects to frontend team page after accepting invitation' })
    @ApiResponse({ status: 400, description: 'Invalid or expired token - redirects to error page' })
    @ApiResponse({ status: 404, description: 'Invitation not found - redirects to error page' })
    @ApiResponse({ status: 409, description: 'Already a member - redirects to team page' })
    async acceptInviteViaLink(
        @Request() req: any,
        @Param('token') token: string,
        @Res() res: Response
    ) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        
        try {
            const result = await this.teamService.acceptInvite(req.user.sub, { token });
            // Redirect to team page on success
            return res.redirect(`${frontendUrl}/teams/${result.team.id}`);
        } catch (error) {
            // Redirect to frontend invite page with token for manual processing
            return res.redirect(`${frontendUrl}/teams/invite/accept/${token}?error=${encodeURIComponent(error.message)}`);
        }
    }

    @Put('/:teamId/members/:memberId/role')
    @ApiOperation({ summary: 'Update team member role' })
    @ApiParam({ name: 'teamId', description: 'Team ID' })
    @ApiParam({ name: 'memberId', description: 'Member ID' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                role: {
                    type: 'string',
                    enum: ['ADMIN', 'MEMBER'],
                    description: 'New role for the member'
                }
            },
            required: ['role']
        }
    })
    @ApiResponse({
        status: 200,
        description: 'Member role updated successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Member role updated successfully' },
                member: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        role: { type: 'string' },
                        name: { type: 'string' },
                        email: { type: 'string' }
                    }
                }
            }
        }
    })
    @ApiResponse({ status: 403, description: 'Only team owners can update member roles' })
    @ApiResponse({ status: 404, description: 'Team or member not found' })
    async updateMemberRole(
        @Request() req: any,
        @Param('teamId') teamId: string,
        @Param('memberId') memberId: string,
        @Body() body: { role: 'ADMIN' | 'MEMBER' }
    ) {
        return this.teamService.updateMemberRole(req.user.sub, teamId, memberId, body.role);
    }
}