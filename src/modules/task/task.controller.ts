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
    ApiParam,
    ApiBody
} from '@nestjs/swagger';
import {  Task} from '@prisma/client';
import { TaskService, PaginatedTasks } from './task.service';
import { TextGenerationService } from '../task-ai/services/text-generation.service';
import { ParseTaskDto } from '../task-ai/dto/parse-task.dto';
import {
    CreateTaskDto,
    UpdateTaskDto,
    QueryTaskDto,
    TaskStatus,
    TaskPriority,
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
    constructor(private readonly taskService: TaskService, private readonly textGenService: TextGenerationService) {}

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

        @Post('parse')
        @ApiBody({ type: ParseTaskDto })
        async parseTask(@Body() body: ParseTaskDto) {
            const { input } = body;

            // Génération automatique via HF API
                const generated = await this.textGenService.generateTask(input);

                // Détection de date
                const parsedDate = this.taskService.parseUserText(input).dueDate;

                // Robust normalization: accept canonical English labels, localized labels and common verb forms.
                const normalizeToTaskStatus = (raw: any): TaskStatus => {
                    const s = String(raw ?? '').toLowerCase().trim();

                    // DONE indicators (en/fr/es/pt/de + common phrasing)
                    if (/(\b(done|finished|completed|fini|fait|pagad|pagada|pagado|paguei|paguei|ya pag|já pag|já pago|pagou)\b|j'?ai pay|j'ai payé|j'ai déjà payé|ya pagu[ea]|he pagado)/i.test(s)) {
                        return TaskStatus.DONE;
                    }

                    // IN_PROGRESS indicators (progressive forms, 'en train', 'working on', etc.)
                    if (/\b(in progress|in_progress|working on|working|doing|en cours|en train(?: de)?|je suis en train|suis en train|trabajando|estoy trabajando|estou trabalhando|ich arbeite)\b/i.test(s)) {
                        return TaskStatus.IN_PROGRESS;
                    }

                    // CANCELLED indicators
                    if (/\b(cancel|cancelled|canceled|annul|anulado|cancelado|abbrechen|abgesagt)\b/i.test(s)) {
                        return TaskStatus.CANCELLED;
                    }

                    // TODO indicators
                    if (/\b(todo|to do|à faire|a faire|por hacer)\b/i.test(s)) {
                        return TaskStatus.TODO;
                    }

                    // If the generated value already matches one of the enum keys (case-insensitive), use it
                    try {
                        const up = String(raw).toUpperCase();
                        if (Object.values(TaskStatus).includes(up as any)) return up as TaskStatus;
                    } catch (e) {
                        // ignore
                    }

                    // Fallback
                    return TaskStatus.TODO;
                };

                const normalizePriority = (raw: any) => {
                    const p = String(raw ?? '').toLowerCase().trim();
                    if (/\b(urgent|asap|immediately|immédiat|immediatamente|urgente|ahora|agora)\b/i.test(p)) return TaskPriority.URGENT;
                    if (/\b(high|important|soon|important|importante|importante)\b/i.test(p)) return TaskPriority.HIGH;
                    if (/\b(low|optional|when possible|eventually|faible|bajo|opcional)\b/i.test(p)) return TaskPriority.LOW;
                    return TaskPriority.MEDIUM;
                };

                // Consider multiple sources for status detection: AI status, localized label, generated description and original input
                const statusSource = [generated.status, generated.statusLabel, generated.description, input]
                    .filter(Boolean)
                    .join(' ');

                const normalizedStatus = normalizeToTaskStatus(statusSource);

                // Priority: prefer LLM suggestion when confidence is sufficient, otherwise use heuristics
                const llmPriorityStr = String(generated.priority ?? '').toLowerCase().trim();
                const llmConfidence = Number(generated.priorityConfidence ?? 0);

                const priorityMap: { [k: string]: TaskPriority } = {
                    low: TaskPriority.LOW,
                    medium: TaskPriority.MEDIUM,
                    high: TaskPriority.HIGH,
                    urgent: TaskPriority.URGENT
                };

                let finalPriority: TaskPriority | null = null;

                // Accept LLM priority when confidence >= 0.6
                if (llmConfidence && llmConfidence >= 0.6 && priorityMap[llmPriorityStr]) {
                    finalPriority = priorityMap[llmPriorityStr];
                } else {
                    // Heuristics based on due date and semantic keywords
                    const now = new Date();
                    try {
                        if (parsedDate) {
                            const diffMs = parsedDate.getTime() - now.getTime();
                            const diffHours = diffMs / (1000 * 60 * 60);
                            if (diffHours <= 24) finalPriority = TaskPriority.URGENT;
                            else if (diffHours <= 24 * 7) finalPriority = TaskPriority.HIGH;
                            else finalPriority = TaskPriority.MEDIUM;
                        } else {
                            // semantic cues in the full text (statusSource covers generated fields + input)
                            const s = statusSource.toLowerCase();
                            // health/medical → URGENT
                            if (/\b(douleur|urgence|urgence m[ée]dicale|m[ée]decin|hospital|chest pain|sant[eé]|emergency)\b/i.test(s)) {
                                finalPriority = TaskPriority.URGENT;
                            } else if (/\b(facture|payer|paiement|paid|pay[eé]|invoice|bill|virement)\b/i.test(s)) {
                                // financial matters → HIGH
                                finalPriority = TaskPriority.HIGH;
                            } else if (/\b(asap|urgent|maintenant|imm[ée]diat|ahora|ahora mismo|sofort)\b/i.test(s)) {
                                finalPriority = TaskPriority.URGENT;
                            } else if (priorityMap[llmPriorityStr]) {
                                finalPriority = priorityMap[llmPriorityStr];
                            } else {
                                finalPriority = TaskPriority.MEDIUM;
                            }
                        }
                    } catch (e) {
                        finalPriority = priorityMap[llmPriorityStr] ?? TaskPriority.MEDIUM;
                    }
                }

                // Map enum back to lowercase canonical string for preview (low|medium|high|urgent)
                const enumToLower: { [k in TaskPriority]: string } = {
                    [TaskPriority.LOW]: 'low',
                    [TaskPriority.MEDIUM]: 'medium',
                    [TaskPriority.HIGH]: 'high',
                    [TaskPriority.URGENT]: 'urgent'
                };

                const priorityStr = enumToLower[finalPriority as TaskPriority] ?? 'medium';

                // Compute localized statusLabel from normalizedStatus and language (overwrite any stale label from generated)
                const lang = generated.language || 'en';
                const statusLabelMap: { [lang: string]: { [k in TaskStatus]?: string } } = {
                    en: {
                        [TaskStatus.TODO]: 'To Do',
                        [TaskStatus.IN_PROGRESS]: 'In Progress',
                        [TaskStatus.DONE]: 'Done',
                        [TaskStatus.CANCELLED]: 'Cancelled'
                    },
                    fr: {
                        [TaskStatus.TODO]: 'À faire',
                        [TaskStatus.IN_PROGRESS]: 'En cours',
                        [TaskStatus.DONE]: 'Terminé',
                        [TaskStatus.CANCELLED]: 'Annulé'
                    },
                    es: {
                        [TaskStatus.TODO]: 'Por hacer',
                        [TaskStatus.IN_PROGRESS]: 'En progreso',
                        [TaskStatus.DONE]: 'Hecho',
                        [TaskStatus.CANCELLED]: 'Cancelado'
                    },
                    pt: {
                        [TaskStatus.TODO]: 'A fazer',
                        [TaskStatus.IN_PROGRESS]: 'Em progresso',
                        [TaskStatus.DONE]: 'Concluído',
                        [TaskStatus.CANCELLED]: 'Cancelado'
                    },
                    de: {
                        [TaskStatus.TODO]: 'Zu erledigen',
                        [TaskStatus.IN_PROGRESS]: 'In Bearbeitung',
                        [TaskStatus.DONE]: 'Erledigt',
                        [TaskStatus.CANCELLED]: 'Abgebrochen'
                    }
                };

                const localizedStatusLabel = (statusLabelMap[lang] && statusLabelMap[lang][normalizedStatus]) || statusLabelMap['en'][normalizedStatus];

                // Return: keep LLM metadata for audit/UI, but expose `priority` as low|medium|high|urgent for the frontend preview
                return {
                    ...generated,
                    status: normalizedStatus,
                    statusLabel: localizedStatusLabel,
                    priority: priorityStr,
                    priorityEnum: finalPriority,
                    priorityConfidence: generated.priorityConfidence ?? null,
                    priorityReason: generated.priorityReason ?? '',
                    dueDate: parsedDate ?? null
                };
        }
    
}
