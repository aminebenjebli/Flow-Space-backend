import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
    IsString,
    IsOptional,
    IsEnum,
    IsDateString,
    MinLength,
    MaxLength,
    IsArray,
    ArrayNotEmpty,
    IsMongoId
} from 'class-validator';

export enum TaskStatus {
    TODO = 'TODO',
    IN_PROGRESS = 'IN_PROGRESS',
    DONE = 'DONE',
    CANCELLED = 'CANCELLED'
}

export enum TaskPriority {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    URGENT = 'URGENT'
}

export class CreateTaskDto {
    @ApiProperty({
        example: 'Complete project documentation',
        description: 'Task title'
    })
    @IsString({ message: 'Title must be a string' })
    @MinLength(1, { message: 'Title cannot be empty' })
    @MaxLength(200, { message: 'Title cannot exceed 200 characters' })
    @Transform(({ value }) => value?.trim())
    title: string;

    @ApiProperty({
        example:
            'Write comprehensive documentation for the project including API endpoints and setup instructions',
        description: 'Detailed task description',
        required: false
    })
    @IsOptional()
    @IsString({ message: 'Description must be a string' })
    @MaxLength(1000, { message: 'Description cannot exceed 1000 characters' })
    @Transform(({ value }) => value?.trim())
    description?: string;

    @ApiProperty({
        enum: TaskStatus,
        example: TaskStatus.TODO,
        description: 'Task status',
        required: false
    })
    @IsOptional()
    @IsEnum(TaskStatus, { message: 'Status must be a valid task status' })
    status?: TaskStatus;

    @ApiProperty({
        enum: TaskPriority,
        example: TaskPriority.MEDIUM,
        description: 'Task priority',
        required: false
    })
    @IsOptional()
    @IsEnum(TaskPriority, { message: 'Priority must be a valid task priority' })
    priority?: TaskPriority;

    @ApiProperty({
        example: '2025-12-31T23:59:59.000Z',
        description: 'Task due date',
        required: false
    })
    @IsOptional()
    @IsDateString({}, { message: 'Due date must be a valid ISO date string' })
    dueDate?: string;

    @ApiProperty({
        example: '507f1f77bcf86cd799439011',
        description: 'Project ID (optional - assigns task to a project)',
        required: false
    })
    @IsOptional()
    @IsString({ message: 'Project ID must be a string' })
    @IsMongoId({ message: 'Project ID must be a valid MongoDB ObjectId' })
    projectId?: string;
}

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
    // completed field removed - use status field instead
}

export class QueryTaskDto {
    @ApiProperty({
        enum: TaskStatus,
        description: 'Filter by task status',
        required: false
    })
    @IsOptional()
    @IsEnum(TaskStatus, { message: 'Status must be a valid task status' })
    status?: TaskStatus;

    @ApiProperty({
        enum: TaskPriority,
        description: 'Filter by task priority',
        required: false
    })
    @IsOptional()
    @IsEnum(TaskPriority, { message: 'Priority must be a valid task priority' })
    priority?: TaskPriority;

    @ApiProperty({
        example: 'documentation',
        description: 'Search in title and description',
        required: false
    })
    @IsOptional()
    @IsString({ message: 'Search must be a string' })
    @Transform(({ value }) => value?.trim())
    search?: string;

    @ApiProperty({
        example: '2025-01-01',
        description: 'Filter tasks due from this date',
        required: false
    })
    @IsOptional()
    @IsDateString({}, { message: 'Due from must be a valid date' })
    dueFrom?: string;

    @ApiProperty({
        example: '2025-12-31',
        description: 'Filter tasks due until this date',
        required: false
    })
    @IsOptional()
    @IsDateString({}, { message: 'Due until must be a valid date' })
    dueUntil?: string;

    @ApiProperty({
        example: '507f1f77bcf86cd799439011',
        description: 'Filter tasks by project ID',
        required: false
    })
    @IsOptional()
    @IsString({ message: 'Project ID must be a string' })
    @IsMongoId({ message: 'Project ID must be a valid MongoDB ObjectId' })
    projectId?: string;

    @ApiProperty({
        example: '1',
        description: 'Page number (default: 1)',
        required: false
    })
    @IsOptional()
    @Type(() => Number)
    page?: number = 1;

    @ApiProperty({
        example: '10',
        description: 'Items per page (default: 10, max: 100)',
        required: false
    })
    @IsOptional()
    @Type(() => Number)
    limit?: number = 10;

    @ApiProperty({
        example: 'createdAt',
        description: 'Sort by field (createdAt, updatedAt, dueDate, priority)',
        required: false
    })
    @IsOptional()
    @IsString()
    sortBy?: string = 'createdAt';

    @ApiProperty({
        example: 'desc',
        description: 'Sort order (asc, desc)',
        required: false
    })
    @IsOptional()
    @IsString()
    sortOrder?: 'asc' | 'desc' = 'desc';
}

export class BulkUpdateStatusDto {
    @ApiProperty({
        example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
        description: 'Array of task IDs to update',
        type: [String]
    })
    @IsArray({ message: 'taskIds must be an array' })
    @ArrayNotEmpty({ message: 'taskIds cannot be empty' })
    @IsString({ each: true, message: 'Each task ID must be a string' })
    taskIds: string[];

    @ApiProperty({
        enum: TaskStatus,
        example: TaskStatus.DONE,
        description: 'New status for the tasks'
    })
    @IsEnum(TaskStatus, { message: 'Status must be a valid task status' })
    status: TaskStatus;
}
