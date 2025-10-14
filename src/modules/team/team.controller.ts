import {
    Controller,
    Get,
    Post,
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
    @ApiResponse({ status: 400, description: 'Invalid or expired token' })
    @ApiResponse({ status: 404, description: 'Invitation not found' })
    @ApiResponse({ status: 409, description: 'Already a member' })
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
        return this.teamService.removeMember(req.user.sub, teamId, userId);
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
}