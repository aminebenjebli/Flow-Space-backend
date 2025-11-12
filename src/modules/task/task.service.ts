import {
    Injectable,
    NotFoundException,
    ForbiddenException
} from '@nestjs/common';
const chrono: any = require('chrono-node');
import { Prisma, Task } from '@prisma/client';
import { PrismaService } from '../../core/services/prisma.service';
import { TeamAccessService } from '../team/team-access.service';
import {
    CreateTaskDto,
    UpdateTaskDto,
    QueryTaskDto,
    TaskStatus
} from './dto/task.dto';
import { TasksGateway } from './tasks.gateway';

export interface PaginatedTasks {
    tasks: Task[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

@Injectable()
export class TaskService {
    constructor(
        private readonly tasksGateway: TasksGateway,
        private readonly prismaService: PrismaService,
        private readonly teamAccessService: TeamAccessService
    ) {}

    async create(userId: string, createTaskDto: CreateTaskDto): Promise<Task> {
        // If projectId is provided, validate user access to the project
        if (createTaskDto.projectId) {
            const teamId = await this.teamAccessService.getTeamIdFromProject(
                createTaskDto.projectId
            );
            await this.teamAccessService.assertMember(userId, teamId);
        }

        const taskData = {
            title: createTaskDto.title,
            description: createTaskDto.description,
            status: createTaskDto.status || TaskStatus.TODO,
            priority: createTaskDto.priority,
            dueDate: createTaskDto.dueDate
                ? new Date(createTaskDto.dueDate)
                : null,
            userId: userId,
            projectId: createTaskDto.projectId || null
        };

        const task = await this.prismaService.task.create({
            data: taskData,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                project: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        team: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }
            }
        });
        this.tasksGateway.server.emit('taskAdded', task);
        return task;
    }

    async findAll(
        userId: string,
        queryDto: QueryTaskDto
     ): Promise<PaginatedTasks> {
        const {
            status,
            priority,
            search,
            dueFrom,
            dueUntil,
            projectId,
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = queryDto;

        // If projectId is provided, validate user access to the project
        if (projectId) {
            const teamId =
                await this.teamAccessService.getTeamIdFromProject(projectId);
            await this.teamAccessService.assertMember(userId, teamId);
        }

        // Debug logging
        // console.log('=== TASK SEARCH DEBUG ===');
        // console.log('User ID:', userId);
        // console.log('Query params:', queryDto);
        // console.log('Extracted params:', {
        //     status,
        //     priority,
        //     search,
        //     dueFrom,
        //     dueUntil,
        //     page,
        //     limit,
        //     sortBy,
        //     sortOrder
        // });

        // Ensure limit doesn't exceed maximum
        const actualLimit = Math.min(limit, 100);
        const skip = (page - 1) * actualLimit;

        // Build where clause
        const where: Prisma.TaskWhereInput = {
            // If projectId is specified, show all tasks in that project (for team members)
            // Otherwise, show only user's personal tasks
            ...(projectId ? { projectId } : { userId }),
            ...(status && { status }),
            ...(priority && { priority }),
            ...(dueFrom && {
                dueDate: {
                    gte: new Date(dueFrom + 'T00:00:00.000Z')
                }
            }),
            ...(dueUntil && {
                dueDate: {
                    lte: (() => {
                        // Handle invalid dates like 2025-11-31
                        try {
                            const date = new Date(dueUntil + 'T23:59:59.999Z');
                            if (isNaN(date.getTime())) {
                                console.log('Invalid dueUntil date:', dueUntil);
                                return new Date('2099-12-31T23:59:59.999Z'); // Fallback to far future
                            }
                            return date;
                        } catch (error) {
                            console.log(
                                'Error parsing dueUntil date:',
                                dueUntil,
                                error
                            );
                            return new Date('2099-12-31T23:59:59.999Z'); // Fallback to far future
                        }
                    })()
                }
            }),
            ...(search && {
                OR: [
                    { title: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } }
                ]
            })
        };

        // Handle both dueFrom and dueUntil filters together
        if (dueFrom && dueUntil) {
            try {
                const fromDate = new Date(dueFrom + 'T00:00:00.000Z');
                const untilDate = new Date(dueUntil + 'T23:59:59.999Z');

                if (!isNaN(fromDate.getTime()) && !isNaN(untilDate.getTime())) {
                    where.dueDate = {
                        gte: fromDate,
                        lte: untilDate
                    };
                } else {
                    console.log('Invalid date range - skipping date filters');
                    delete where.dueDate;
                }
            } catch (error) {
                console.log(
                    'Error with date range - skipping date filters:',
                    error
                );
                delete where.dueDate;
            }
        }

        console.log('Built where clause:', JSON.stringify(where, null, 2));

        // Build orderBy clause
        const orderBy: Prisma.TaskOrderByWithRelationInput = {};
        if (sortBy === 'priority') {
            // Custom priority ordering: URGENT > HIGH > MEDIUM > LOW
            orderBy.priority = sortOrder as 'asc' | 'desc';
        } else if (['createdAt', 'updatedAt', 'dueDate'].includes(sortBy)) {
            orderBy[sortBy] = sortOrder as 'asc' | 'desc';
        } else {
            orderBy.createdAt = 'desc';
        }

        // Execute queries in parallel
        const [tasks, total] = await Promise.all([
            this.prismaService.task.findMany({
                where,
                orderBy,
                skip,
                take: actualLimit,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    },
                    project: {
                        select: {
                            id: true,
                            name: true,
                            description: true,
                            team: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    }
                }
            }),
            this.prismaService.task.count({ where })
        ]);

        // console.log('Query results:', { tasksFound: tasks.length, total });
        // console.log('=== END DEBUG ===');

        return {
            tasks,
            total,
            page,
            limit: actualLimit,
            totalPages: Math.ceil(total / actualLimit)
        };
    }

    async findOne(userId: string, taskId: string): Promise<Task> {
        const task = await this.prismaService.task.findFirst({
            where: {
                id: taskId,
                userId
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                project: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        team: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }
            }
        });

        if (!task) {
            throw new NotFoundException('Task not found');
        }

        return task;
    }

    async update(
        userId: string,
        taskId: string,
        updateTaskDto: UpdateTaskDto
     ): Promise<Task> {
        // Check if task exists and belongs to user
        const existingTask = await this.findOne(userId, taskId);

        // If projectId is being updated, validate user membership in the new project's team
        if (
            updateTaskDto.projectId !== undefined &&
            updateTaskDto.projectId !== existingTask.projectId
        ) {
            if (updateTaskDto.projectId) {
                const teamId =
                    await this.teamAccessService.getTeamIdFromProject(
                        updateTaskDto.projectId
                    );
                await this.teamAccessService.assertMember(userId, teamId);
            }
        }

        const updateData: any = {};

        if (updateTaskDto.title !== undefined)
            updateData.title = updateTaskDto.title;
        if (updateTaskDto.description !== undefined)
            updateData.description = updateTaskDto.description;
        if (updateTaskDto.status !== undefined)
            updateData.status = updateTaskDto.status;
        if (updateTaskDto.priority !== undefined)
            updateData.priority = updateTaskDto.priority;
        if (updateTaskDto.dueDate !== undefined) {
            updateData.dueDate = updateTaskDto.dueDate
                ? new Date(updateTaskDto.dueDate)
                : null;
        }
        if (updateTaskDto.projectId !== undefined) {
            updateData.projectId = updateTaskDto.projectId || null;
        }

        const before = await this.findOne(userId, taskId);

        const updated = await this.prismaService.task.update({
            where: { id: taskId },
            data: updateData,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                project: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        team: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }
            }
        });
        this.tasksGateway.server.emit('taskUpdated', updated);
        return updated;
    }

    async remove(userId: string, taskId: string): Promise<Task> {
        await this.findOne(userId, taskId);

        const deletedTask = await this.prismaService.task.delete({
            where: { id: taskId },
            include: {
                user: { select: { id: true, name: true, email: true } },
                project: { select: { id: true, name: true, description: true } }
            }
        });

        // Emit the taskDeleted event to notify connected clients
        this.tasksGateway.server.emit('taskDeleted', deletedTask);
        return deletedTask;
    }

    async getTaskStats(userId: string): Promise<{
        total: number;
        todo: number;
        inProgress: number;
        done: number;
        cancelled: number;
        overdue: number;
    }> {
        const now = new Date();

        const [total, todo, inProgress, done, cancelled, overdue] =
            await Promise.all([
                this.prismaService.task.count({ where: { userId } }),
                this.prismaService.task.count({
                    where: { userId, status: TaskStatus.TODO }
                }),
                this.prismaService.task.count({
                    where: { userId, status: TaskStatus.IN_PROGRESS }
                }),
                this.prismaService.task.count({
                    where: { userId, status: TaskStatus.DONE }
                }),
                this.prismaService.task.count({
                    where: { userId, status: TaskStatus.CANCELLED }
                }),
                this.prismaService.task.count({
                    where: {
                        userId,
                        status: {
                            in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS]
                        },
                        dueDate: { lt: now }
                    }
                })
            ]);

        return {
            total,
            todo,
            inProgress,
            done,
            cancelled,
            overdue
        };
    }

    async bulkUpdateStatus(
        userId: string,
        taskIds: string[],
        status: TaskStatus
     ): Promise<{ count: number }> {
        // Validate input parameters
        if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
            throw new ForbiddenException('taskIds must be a non-empty array');
        }

        if (!status) {
            throw new ForbiddenException('status is required');
        }

        // Verify all tasks belong to the user
        const tasks = await this.prismaService.task.findMany({
            where: {
                id: { in: taskIds },
                userId
            },
            select: { id: true }
        });

        if (tasks.length !== taskIds.length) {
            // One or more task IDs do not belong to the user
            throw new ForbiddenException('One or more tasks do not belong to the user');
        }

        const updateData = {
            status
        };

        const result = await this.prismaService.task.updateMany({
            where: {
                id: { in: taskIds },
                userId
            },
            data: updateData
        });
         this.tasksGateway.server.emit('bulkUpdateStatus', {
        count: result.count, 
        taskIds: taskIds,
        status: status
     });

        return { count: result.count };
    }

    parseUserText(input: string) {
        // Multilingue : on essaie plusieurs parseurs locaux de chrono-node
        // chrono-node fournit des parseurs par langue : chrono.fr, chrono.es, chrono.pt, chrono.de, etc.
        // Stratégie : heuristique rapide pour détecter la langue, sinon tenter FR/ES/PT/DE/EN dans cet ordre.
        const text = (input || '').trim();
        if (!text) return { dueDate: null, parsedText: null };

        // Heuristique simple basé sur mots-clés pour favoriser certains parseurs
        const lower = text.toLowerCase();
        const langHints: { [k: string]: string[] } = {
            fr: [
                'aujourd',
                'demain',
                'prochain',
                'prochaine',
                'janvier',
                'févr',
                'mars',
                'avril',
                'mai',
                'juin',
                'juillet',
                'août',
                'sept',
                'oct',
                'nov',
                'déc'
            ],
            es: [
                'mañana',
                'próxima',
                'enero',
                'febrero',
                'marzo',
                'abril',
                'mayo',
                'junio',
                'julio',
                'agosto',
                'septiembre',
                'octubre',
                'noviembre',
                'diciembre'
            ],
            pt: [
                'amanhã',
                'próxima',
                'próximo',
                'janeiro',
                'fevereiro',
                'março',
                'abril',
                'maio',
                'junho',
                'julho',
                'agosto',
                'setembro',
                'outubro',
                'novembro',
                'dezembro'
            ],
            de: [
                'morgen',
                'nächste',
                'januar',
                'februar',
                'märz',
                'april',
                'mai',
                'juni',
                'juli',
                'august',
                'september',
                'oktober',
                'november',
                'dezember'
            ]
        };

        let preferredOrder: Array<any> = [];
        try {
            // Build parser order based on hints
            const foundLangs: string[] = [];
            for (const [lang, hints] of Object.entries(langHints)) {
                for (const h of hints) {
                    if (lower.includes(h)) {
                        foundLangs.push(lang);
                        break;
                    }
                }
            }

            const parsers: { [k: string]: any } = {
                fr: (chrono as any).fr,
                es: (chrono as any).es,
                pt: (chrono as any).pt,
                de: (chrono as any).de,
                en: chrono
            };

            // If we detected hints, try those first (unique)
            for (const lang of Array.from(new Set(foundLangs))) {
                if (parsers[lang]) preferredOrder.push(parsers[lang]);
            }

            // Then the default full order
            for (const lang of ['fr', 'es', 'pt', 'de', 'en']) {
                const p = parsers[lang];
                if (!preferredOrder.includes(p)) preferredOrder.push(p);
            }
        } catch (e) {
            // Fallback order in case of any issue
            preferredOrder = [
                (chrono as any).fr,
                (chrono as any).es,
                (chrono as any).pt,
                (chrono as any).de,
                chrono
            ];
        }

        let dueDate: Date | null = null;
        let matchedText: string | null = null;
        for (const parser of preferredOrder) {
            try {
                if (!parser || typeof parser.parse !== 'function') continue;
                const results = parser.parse(text);
                if (results && results.length > 0 && results[0].start) {
                    dueDate = results[0].start.date();
                    matchedText = results[0].text;
                    break;
                }
            } catch (err) {
                // ignore and try next parser
                continue;
            }
        }

        return {
            dueDate,
            parsedText: matchedText
        };
    }
}
