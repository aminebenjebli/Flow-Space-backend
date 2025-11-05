import { IsString, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProposeByUserDto {
  @IsString()
  @ApiProperty({ description: 'User id to fetch tasks for', example: 'user_123' })
  userId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ description: 'Maximum number of suggestions to return', example: 3 })
  maxSuggestions?: number;
}
