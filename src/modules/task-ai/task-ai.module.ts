import { Module } from '@nestjs/common';
import { TextGenerationService } from './services/text-generation.service';
import { TaskAiController } from './task-ai.controller';
import { OpenrouterService } from './services/openrouter.service';


@Module({
  imports: [],
  controllers: [TaskAiController],
  providers: [TextGenerationService, OpenrouterService],
  exports: [TextGenerationService, OpenrouterService],
})
export class TaskAiModule {}
