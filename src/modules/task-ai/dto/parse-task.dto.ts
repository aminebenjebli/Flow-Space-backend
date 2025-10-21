import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ParseTaskDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: 'Text to parse into a task', example: 'Tomorrow at 10am buy milk urgent' })
    input: string;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional({ description: 'Optional language code (ignored by server, kept for backward compatibility)', example: 'en' })
    lang?: string;
}
