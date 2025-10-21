import { Controller, Post, Body } from '@nestjs/common';
import { TextGenerationService } from './services/text-generation.service';
import { ParseTaskDto } from './dto/parse-task.dto';

@Controller('task-ai')
export class TaskAiController {
  constructor(private readonly textService: TextGenerationService) {}

  @Post('parse')
  async parse(@Body() dto: ParseTaskDto) {
    return this.textService.generateTask(dto.input);
  }
}
