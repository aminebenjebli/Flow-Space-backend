import { IsString, IsInt, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Response DTO for achievement definitions (global achievements)
export class AchievementDefinitionDTO {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiPropertyOptional()
  icon?: string;

  @ApiProperty()
  pointsAwarded: number;

  @ApiProperty({ description: 'Achievement criteria code', example: 'COMPLETE_50_TASKS' })
  criteria: string;

  @ApiProperty({ description: 'Target value to unlock', example: 50 })
  targetValue: number;

  @ApiProperty()
  createdAt: Date;
}

// Response DTO for user's unlocked achievements (AC-3: Achievement badges unlock)
export class UserAchievementDTO {
  @ApiProperty()
  id: string;

  @ApiProperty()
  achievementId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiPropertyOptional()
  icon?: string;

  @ApiProperty()
  pointsAwarded: number;

  @ApiProperty({ description: 'Current progress toward achievement' })
  progress: number;

  @ApiProperty({ description: 'Target value needed to unlock' })
  targetValue: number;

  @ApiProperty()
  unlockedAt: Date;

  @ApiProperty({ description: 'AC-7: Whether user was notified' })
  notified: boolean;

  @ApiProperty({ description: 'Whether achievement is unlocked' })
  isUnlocked: boolean;
}

// Request DTO for creating achievement definitions (admin only)
export class CreateAchievementDefinitionDTO {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty()
  @IsInt()
  pointsAwarded: number;

  @ApiProperty({ description: 'Achievement criteria code', example: 'COMPLETE_50_TASKS' })
  @IsString()
  criteria: string;

  @ApiProperty({ description: 'Target value to unlock', example: 50 })
  @IsInt()
  targetValue: number;
}

// Response DTO for achievement progress tracking
export class AchievementProgressDTO {
  @ApiProperty()
  achievementId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  icon?: string;

  @ApiProperty()
  progress: number;

  @ApiProperty()
  targetValue: number;

  @ApiProperty()
  percentage: number;

  @ApiProperty()
  isUnlocked: boolean;
}