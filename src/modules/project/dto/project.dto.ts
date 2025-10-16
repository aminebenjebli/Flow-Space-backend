import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    IsString,
    IsOptional,
    MinLength,
    MaxLength,
    IsEnum
} from 'class-validator';

export enum ProjectVisibility {
    PUBLIC = 'PUBLIC',
    PRIVATE = 'PRIVATE'
}

export class CreateProjectDto {
    @ApiProperty({
        example: '507f1f77bcf86cd799439011',
        description: 'Team ID where the project will be created (optional for personal projects)',
        required: false
    })
    @IsOptional()
    @IsString({ message: 'Team ID must be a string' })
    @MinLength(1, { message: 'Team ID cannot be empty' })
    teamId?: string;

    @ApiProperty({
        example: 'Mobile App Project',
        description: 'Project name'
    })
    @IsString({ message: 'Name must be a string' })
    @MinLength(1, { message: 'Name cannot be empty' })
    @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
    @Transform(({ value }) => value?.trim())
    name: string;

    @ApiProperty({
        example: 'Development of the mobile application for iOS and Android',
        description: 'Project description',
        required: false
    })
    @IsOptional()
    @IsString({ message: 'Description must be a string' })
    @MaxLength(500, { message: 'Description cannot exceed 500 characters' })
    @Transform(({ value }) => value?.trim())
    description?: string;

    @ApiProperty({
        enum: ProjectVisibility,
        example: ProjectVisibility.PRIVATE,
        description: 'Project visibility',
        required: false,
        default: ProjectVisibility.PRIVATE
    })
    @IsOptional()
    @IsEnum(ProjectVisibility, { message: 'Visibility must be either PUBLIC or PRIVATE' })
    visibility?: ProjectVisibility;
}

export class UpdateProjectSettingsDto {
    @ApiProperty({
        enum: ProjectVisibility,
        example: ProjectVisibility.PUBLIC,
        description: 'Project visibility',
        required: false
    })
    @IsOptional()
    @IsEnum(ProjectVisibility, { message: 'Visibility must be either PUBLIC or PRIVATE' })
    visibility?: ProjectVisibility;

    @ApiProperty({
        example: '507f1f77bcf86cd799439011',
        description: 'Team ID to attach/detach (null to detach)',
        required: false,
        nullable: true
    })
    @IsOptional()
    @IsString({ message: 'Team ID must be a string' })
    teamId?: string | null;
}

export class ProjectResponseDto {
    @ApiProperty({ example: '507f1f77bcf86cd799439011' })
    id: string;

    @ApiProperty({ example: '507f1f77bcf86cd799439009' })
    ownerId: string;

    @ApiProperty({ example: '507f1f77bcf86cd799439010', nullable: true })
    teamId?: string | null;

    @ApiProperty({ example: 'Mobile App Project' })
    name: string;

    @ApiProperty({ example: 'Development of the mobile application' })
    description?: string;

    @ApiProperty({ enum: ProjectVisibility, example: ProjectVisibility.PRIVATE })
    visibility: ProjectVisibility;

    @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
    createdAt: Date;

    @ApiProperty({
        description: 'Team information',
        type: 'object',
        properties: {
            id: { type: 'string', example: '507f1f77bcf86cd799439010' },
            name: { type: 'string', example: 'Development Team' },
            description: { type: 'string', example: 'Main development team' }
        }
    })
    team?: {
        id: string;
        name: string;
        description?: string;
    };

    @ApiProperty({
        description: 'Number of tasks in this project',
        example: 5
    })
    taskCount?: number;
}