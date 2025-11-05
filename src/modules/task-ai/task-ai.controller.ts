import { Controller, Post, Body } from '@nestjs/common';
import { TextGenerationService } from './services/text-generation.service';
import { ProposeByUserDto } from './dto/propose-by-user.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { PrismaService } from '../../core/services/prisma.service';

@ApiTags('task-ai')
@Controller('task-ai')
export class TaskAiController {
  constructor(
    private readonly textService: TextGenerationService,
    private readonly prisma: PrismaService,
  ) {}
  /**
   * Fetch tasks for a given userId and propose new tasks
   */
  @Post('propose-by-user')
  @ApiOperation({ summary: 'Propose tasks using a userId (server loads user tasks)' })
  @ApiBody({ type: ProposeByUserDto })
  @ApiResponse({ status: 200, description: 'Array of suggested tasks' })
  async proposeByUser(@Body() dto: ProposeByUserDto) {
    const userId = dto.userId;

    // Fetch user's tasks (limit to reasonable number)
    const tasks = await this.prisma.task.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        status: true,
        dueDate: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const suggestions = await this.textService.proposeTasksFromUserTasks(tasks, {
      maxSuggestions: dto.maxSuggestions,
    });

    return { suggestions };
  }
}
