import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
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
    ApiQuery,
    ApiParam
} from '@nestjs/swagger';
import { Task } from '@prisma/client';
import { TaskService, PaginatedTasks } from './task.service';
import {
    CreateTaskDto,
    UpdateTaskDto,
    QueryTaskDto,
    TaskStatus,
    BulkUpdateStatusDto
} from './dto/task.dto';
import { AuthGuard } from '../../core/common/guards/auth.guard';

interface AuthenticatedRequest extends Request {
    user: {
        sub: string;
        name: string;
        email: string;
        image?: string;
        bio?: string;
    };
}

@ApiTags('Tasks')
@Controller('tasks')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class TaskController {
    constructor(private readonly taskService: TaskService) {}

    @Post()
    @ApiOperation({
        summary: 'Create a new task',
        description: 'Creates a new task for the authenticated user'
    })
    @ApiResponse({
        status: 201,
        description: 'Task created successfully',
        type: Object
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid task data'
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized'
    })
    create(
        @Request() req: AuthenticatedRequest,
        @Body() createTaskDto: CreateTaskDto
    ): Promise<Task> {
        return this.taskService.create(req.user.sub, createTaskDto);
    }

    @Get()
    @ApiOperation({
        summary: 'Get all tasks',
        description:
            'Retrieves all tasks for the authenticated user with optional filters and pagination'
    })
    @ApiQuery({ name: 'status', enum: TaskStatus, required: false })
    @ApiQuery({ name: 'priority', required: false })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'dueFrom', required: false })
    @ApiQuery({ name: 'dueUntil', required: false })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    @ApiQuery({ name: 'sortBy', required: false })
    @ApiQuery({ name: 'sortOrder', required: false })
    @ApiResponse({
        status: 200,
        description: 'Tasks retrieved successfully'
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized'
    })
    findAll(
        @Request() req: AuthenticatedRequest,
        @Query() queryDto: QueryTaskDto
    ): Promise<PaginatedTasks> {
        console.log('=== CONTROLLER DEBUG ===');
        console.log('Raw query params:', (req as any).query);
        console.log('Parsed DTO:', queryDto);
        console.log('User from token:', req.user);
        console.log('========================');

        return this.taskService.findAll(req.user.sub, queryDto);
    }

    @Get('stats')
    @ApiOperation({
        summary: 'Get task statistics',
        description: 'Retrieves task statistics for the authenticated user'
    })
    @ApiResponse({
        status: 200,
        description: 'Task statistics retrieved successfully'
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized'
    })
    getStats(@Request() req: AuthenticatedRequest) {
        return this.taskService.getTaskStats(req.user.sub);
    }
    @Get(':id')
    @ApiOperation({
        summary: 'Get a task by ID',
        description:
            'Retrieves a specific task by its ID for the authenticated user'
    })
    @ApiParam({
        name: 'id',
        description: 'Task ID',
        type: 'string'
    })
    @ApiResponse({
        status: 200,
        description: 'Task retrieved successfully'
    })
    @ApiResponse({
        status: 404,
        description: 'Task not found'
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized'
    })
    findOne(
        @Request() req: AuthenticatedRequest,
        @Param('id') id: string
    ): Promise<Task> {
        return this.taskService.findOne(req.user.sub, id);
    }

    @Patch(':id')
    @ApiOperation({
        summary: 'Update a task',
        description: 'Updates a specific task for the authenticated user'
    })
    @ApiParam({
        name: 'id',
        description: 'Task ID',
        type: 'string'
    })
    @ApiResponse({
        status: 200,
        description: 'Task updated successfully'
    })
    @ApiResponse({
        status: 404,
        description: 'Task not found'
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid update data'
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized'
    })
    update(
        @Request() req: AuthenticatedRequest,
        @Param('id') id: string,
        @Body() updateTaskDto: UpdateTaskDto
    ): Promise<Task> {
        return this.taskService.update(req.user.sub, id, updateTaskDto);
    }

    @Delete(':id')
    @ApiOperation({
        summary: 'Delete a task',
        description: 'Deletes a specific task for the authenticated user'
    })
    @ApiParam({
        name: 'id',
        description: 'Task ID',
        type: 'string'
    })
    @ApiResponse({
        status: 200,
        description: 'Task deleted successfully'
    })
    @ApiResponse({
        status: 404,
        description: 'Task not found'
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized'
    })
    remove(
        @Request() req: AuthenticatedRequest,
        @Param('id') id: string
    ): Promise<Task> {
        return this.taskService.remove(req.user.sub, id);
    }

    @Patch('bulk/status')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Bulk update task status',
        description:
            'Updates the status of multiple tasks for the authenticated user'
    })
    @ApiResponse({
        status: 200,
        description: 'Tasks updated successfully'
    })
    @ApiResponse({
        status: 403,
        description: 'Some tasks do not belong to you'
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized'
    })
    bulkUpdateStatus(
        @Request() req: AuthenticatedRequest,
        @Body() bulkUpdateDto: BulkUpdateStatusDto
    ): Promise<{ count: number }> {
        return this.taskService.bulkUpdateStatus(
            req.user.sub,
            bulkUpdateDto.taskIds,
            bulkUpdateDto.status
        );
    }
}
