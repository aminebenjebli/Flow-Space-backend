import { Module } from '@nestjs/common';
import { TextGenerationService } from './services/text-generation.service';
import { TaskAiController } from './task-ai.controller';
import { PrismaService } from '../../core/services/prisma.service';

@Module({
  imports: [],
  controllers: [TaskAiController],
  providers: [TextGenerationService, PrismaService],
  exports: [TextGenerationService],
})
export class TaskAiModule {}
