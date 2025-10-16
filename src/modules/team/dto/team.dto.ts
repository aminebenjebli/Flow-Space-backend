import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    IsString,
    IsOptional,
    IsEnum,
    IsEmail,
    MinLength,
    MaxLength
} from 'class-validator';
import { TeamRole } from '@prisma/client';

export class CreateTeamDto {
    @ApiProperty({
        example: 'Development Team',
        description: 'Team name'
    })
    @IsString({ message: 'Name must be a string' })
    @MinLength(1, { message: 'Name cannot be empty' })
    @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
    @Transform(({ value }) => value?.trim())
    name: string;

    @ApiProperty({
        example: 'Main development team for the project',
        description: 'Team description',
        required: false
    })
    @IsOptional()
    @IsString({ message: 'Description must be a string' })
    @MaxLength(500, { message: 'Description cannot exceed 500 characters' })
    @Transform(({ value }) => value?.trim())
    description?: string;
}

export class InviteDto {
    @ApiProperty({
        example: 'user@example.com',
        description: 'Email address of the user to invite'
    })
    @IsEmail({}, { message: 'Invalid email address' })
    @Transform(({ value }) => value?.toLowerCase().trim())
    email: string;

    @ApiProperty({
        example: 'MEMBER',
        description: 'Role to assign to the invited user',
        enum: TeamRole,
        required: false,
        default: TeamRole.MEMBER
    })
    @IsOptional()
    @IsEnum(TeamRole, { message: 'Role must be a valid team role' })
    role?: TeamRole = TeamRole.MEMBER;
}

export class AcceptInviteDto {
    @ApiProperty({
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        description: 'Invitation token received via email'
    })
    @IsString({ message: 'Token must be a string' })
    @MinLength(1, { message: 'Token cannot be empty' })
    token: string;
}

export class RemoveMemberDto {
    @ApiProperty({
        example: '507f1f77bcf86cd799439011',
        description: 'User ID to remove from the team'
    })
    @IsString({ message: 'User ID must be a string' })
    @MinLength(1, { message: 'User ID cannot be empty' })
    userId: string;
}

// Response DTOs for documentation
export class TeamMemberResponseDto {
    @ApiProperty({ example: '507f1f77bcf86cd799439011' })
    id: string;

    @ApiProperty({ example: 'John Doe' })
    name: string;

    @ApiProperty({ example: 'john@example.com' })
    email: string;

    @ApiProperty({ example: 'MEMBER', enum: TeamRole })
    role: TeamRole;

    @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
    joinedAt: Date;
}

export class ProjectResponseDto {
    @ApiProperty({ example: '507f1f77bcf86cd799439011' })
    id: string;

    @ApiProperty({ example: 'Mobile App Project' })
    name: string;

    @ApiProperty({ example: 'Development of the mobile application' })
    description?: string;

    @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
    createdAt: Date;
}

export class TeamResponseDto {
    @ApiProperty({ example: '507f1f77bcf86cd799439011' })
    id: string;

    @ApiProperty({ example: 'Development Team' })
    name: string;

    @ApiProperty({ example: 'Main development team for the project' })
    description?: string;

    @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
    createdAt: Date;

    @ApiProperty({ type: [TeamMemberResponseDto] })
    members: TeamMemberResponseDto[];

    @ApiProperty({ type: [ProjectResponseDto] })
    projects: ProjectResponseDto[];
}

export class InviteResponseDto {
    @ApiProperty({ example: 'Invitation sent successfully' })
    message: string;

    @ApiProperty({ 
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        description: 'Invitation token (only shown in development)' 
    })
    token?: string;
}