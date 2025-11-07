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
import { TasksGateway } from 'src/websocket/tasks.gateway';

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
            const project = await this.prismaService.project.findUnique({
                where: { id: createTaskDto.projectId },
                select: { 
                    teamId: true,
                    ownerId: true,
                    visibility: true
                }
            });

            if (!project) {
                throw new NotFoundException('Project not found');
            }

            // Check access: owner, team member, or public project
            const isOwner = project.ownerId === userId;
            const isPublic = project.visibility === 'PUBLIC';
            
            if (!isOwner && !isPublic) {
                // If project has a team, check team membership
                if (project.teamId) {
                    await this.teamAccessService.assertMember(userId, project.teamId);
                } else {
                    // Personal project that user doesn't own
                    throw new ForbiddenException('Access denied to this project');
                }
            }
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
            const project = await this.prismaService.project.findUnique({
                where: { id: projectId },
                select: { 
                    teamId: true,
                    ownerId: true,
                    visibility: true
                }
            });

            if (!project) {
                throw new NotFoundException('Project not found');
            }

            // Check access: owner, team member, or public project
            const isOwner = project.ownerId === userId;
            const isPublic = project.visibility === 'PUBLIC';
            
            if (!isOwner && !isPublic) {
                // If project has a team, check team membership
                if (project.teamId) {
                    await this.teamAccessService.assertMember(userId, project.teamId);
                } else {
                    // Personal project that user doesn't own
                    throw new ForbiddenException('Access denied to this project');
                }
            }
        }

        // Debug logging
        console.log('=== TASK SEARCH DEBUG ===');
        console.log('User ID:', userId);
        console.log('Query params:', queryDto);
        console.log('Extracted params:', {
            status,
            priority,
            search,
            dueFrom,
            dueUntil,
            page,
            limit,
            sortBy,
            sortOrder
        });

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

        console.log('Query results:', { tasksFound: tasks.length, total });
        console.log('=== END DEBUG ===');

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

        // If projectId is being updated, validate user access to the new project
        if (updateTaskDto.projectId !== undefined && updateTaskDto.projectId !== existingTask.projectId) {
            if (updateTaskDto.projectId) {
                const project = await this.prismaService.project.findUnique({
                    where: { id: updateTaskDto.projectId },
                    select: { 
                        teamId: true,
                        ownerId: true,
                        visibility: true
                    }
                });

                if (!project) {
                    throw new NotFoundException('Project not found');
                }

                // Check access: owner, team member, or public project
                const isOwner = project.ownerId === userId;
                const isPublic = project.visibility === 'PUBLIC';
                
                if (!isOwner && !isPublic) {
                    // If project has a team, check team membership
                    if (project.teamId) {
                        await this.teamAccessService.assertMember(userId, project.teamId);
                    } else {
                        // Personal project that user doesn't own
                        throw new ForbiddenException('Access denied to this project');
                    }
                }
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
           return updated;
    }

    async remove(userId: string, taskId: string): Promise<Task> {
        // Check if task exists and belongs to user
        await this.findOne(userId, taskId);

        return this.prismaService.task.delete({
            where: { id: taskId },
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
                fr: ['aujourd', 'demain', 'prochain', 'prochaine', 'janvier', 'févr', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'sept', 'oct', 'nov', 'déc'],
                es: ['mañana', 'próxima', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
                pt: ['amanhã', 'próxima', 'próximo', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
                de: ['morgen', 'nächste', 'januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember']
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
                preferredOrder = [(chrono as any).fr, (chrono as any).es, (chrono as any).pt, (chrono as any).de, chrono];
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

            // Fallback: try to parse explicit ISO or common numeric dates if chrono failed
            if (!dueDate) {
                try {
                    const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
                    if (iso) {
                        dueDate = new Date(iso[1] + 'T00:00:00');
                        matchedText = iso[1];
                    } else {
                        // DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
                        const alt = text.match(/\b(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4})\b/);
                        if (alt) {
                            // Normalize to YYYY-MM-DD where possible (assume DD/MM/YYYY)
                            const parts = alt[1].split(/[\/\.\-]/);
                            if (parts.length === 3) {
                                let day = parts[0].padStart(2, '0');
                                let month = parts[1].padStart(2, '0');
                                let year = parts[2];
                                if (year.length === 2) year = '20' + year;
                                const isoStr = `${year}-${month}-${day}`;
                                const d = new Date(isoStr + 'T00:00:00');
                                if (!isNaN(d.getTime())) {
                                    dueDate = d;
                                    matchedText = alt[1];
                                }
                            }
                        }
                    }
                } catch (e) {
                    // ignore
                }
            }

            // Post-process heuristics: timezone/time-of-day and future adjustments
            try {
                const now = new Date();

                // helper to add days
                const addDays = (d: Date, days: number) => {
                    const r = new Date(d);
                    r.setDate(r.getDate() + days);
                    return r;
                };

                // If chrono found a date, refine it using keywords (morning/afternoon/evening)
                if (dueDate) {
                    const lower = text.toLowerCase();
                    // time of day heuristics (multilingual)
                    if (/\b(morning|matin|mañana|manhã|morgens)\b/i.test(lower)) {
                        dueDate.setHours(9, 0, 0, 0);
                    } else if (/\b(afternoon|après-?midi|tarde|tarde|nachmittags)\b/i.test(lower)) {
                        dueDate.setHours(15, 0, 0, 0);
                    } else if (/\b(evening|soir|noche|noite|abends)\b/i.test(lower)) {
                        dueDate.setHours(18, 0, 0, 0);
                    } else if (/\b(noon|midi|mediodía|meio-dia)\b/i.test(lower)) {
                        dueDate.setHours(12, 0, 0, 0);
                    } else {
                        // default to start of day for date-only expressions
                        dueDate.setHours(9, 0, 0, 0);
                    }

                    // If parsed date ends up in the past but the text clearly indicates future (tomorrow/next), shift forward
                    const futureIndicators = {
                        tomorrow: ['tomorrow', 'demain', 'mañana', 'amanhã', 'morgen'],
                        next: ['next', 'prochain', 'próximo', 'próxima', 'próxima', 'nächste']
                    };

                    if (dueDate.getTime() < now.getTime()) {
                        // if 'tomorrow' present
                        for (const word of futureIndicators.tomorrow) {
                            if (lower.includes(word)) {
                                dueDate = addDays(dueDate, 1);
                                break;
                            }
                        }

                        // if 'next' present (next week/month), add 7 days as a heuristic
                        if (dueDate.getTime() < now.getTime()) {
                            for (const word of futureIndicators.next) {
                                if (lower.includes(word)) {
                                    dueDate = addDays(dueDate, 7);
                                    break;
                                }
                            }
                        }

                        // Weekday name handling: if user wrote a weekday, move to next occurrence
                        const weekdays: { [k: string]: number } = {
                            sunday: 0, lundi: 1, martes: 2, mercredi: 3, jueves: 4, vendredi: 5, samedi: 6,
                            sunday_en: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
                            domingo: 0, lunes: 1, martes_es: 2, miercoles: 3, jueves_es: 4, viernes: 5, sabado: 6,
                            domingo_pt: 0, segunda: 1, terca: 2, terca_pt: 2, quarta: 3, quinta: 4, sexta: 5, sabado_pt: 6,
                            sonntag: 0, montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6
                        };

                        // basic check for common weekday names in multiple languages
                        const weekdayMap: { [k: string]: number } = {
                            sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
                            dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
                            domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
                            domingo_pt: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado_pt: 6,
                            sonntag: 0, montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6
                        };

                        // try to find any weekday name in the text
                        const weekdayNames = Object.keys(weekdayMap);
                        for (const name of weekdayNames) {
                            if (lower.includes(name)) {
                                const target = weekdayMap[name];
                                // find next date with that weekday
                                const currentWeekday = now.getDay();
                                let delta = (target - currentWeekday + 7) % 7;
                                if (delta === 0) delta = 7; // next occurrence
                                dueDate = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate(), dueDate.getHours(), dueDate.getMinutes(), 0, 0), delta);
                                break;
                            }
                        }
                    }
                }
            } catch (e) {
                // ignore post-processing errors
                console.warn('Date post-processing failed', e?.message || e);
            }

            return {
                dueDate,
                parsedText: matchedText
            };
  }

   async updateTask(taskData: any) {
    // Utiliser la fonction de mise à jour de la tâche
    const updatedTask = await this.update(taskData.userId, taskData.taskId, taskData.updateTaskDto);

    // Une fois la tâche mise à jour, émettre l'événement WebSocket
    try {
        this.tasksGateway.handleTaskUpdate(updatedTask);
    } catch (err) {
        // Non-fatal: log and continue
        console.warn('[Warn] Failed to emit websocket event for updated task:', err && err.message ? err.message : err);
    }

    return updatedTask;
}

}
