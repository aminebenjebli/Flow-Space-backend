import { IsString, IsInt, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Response DTO for points transaction (AC-8: Points history)
export class PointsDTO {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiPropertyOptional()
  taskId?: string;

  @ApiProperty()
  points: number;

  @ApiProperty()
  reason: string;

  @ApiProperty()
  createdAt: Date;
}

// Request DTO for awarding points
export class AwardPointsDTO {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  taskId?: string;

  @ApiProperty()
  @IsInt()
  points: number;

  @ApiProperty()
  @IsString()
  reason: string;
}

// Response DTO for user statistics (AC-4: Personal points and level displayed)
export class UserStatsDTO {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ description: 'Total points accumulated' })
  totalPoints: number;

  @ApiProperty({ description: 'Current level (100 points = 1 level)' })
  level: number;

  @ApiProperty({ description: 'Current consecutive days streak' })
  currentStreak: number;

  @ApiProperty({ description: 'Longest streak ever achieved' })
  longestStreak: number;

  @ApiProperty({ description: 'Total tasks completed' })
  tasksCompleted: number;

  @ApiProperty()
  lastActiveDate: Date;
}

// Response DTO for points history list (AC-8: Points history and progress tracking)
export class PointsHistoryDTO {
  @ApiProperty({ type: [PointsDTO] })
  history: PointsDTO[];

  @ApiProperty()
  totalPoints: number;

  @ApiProperty()
  count: number;
}