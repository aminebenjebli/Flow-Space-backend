import { IsString, IsInt, IsDateString, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Response DTO for challenges (AC-6: Weekly challenges with special rewards)
export class ChallengeDTO {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ description: 'Points rewarded upon completion' })
  pointsRewarded: number;

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({ description: 'Number of users who joined' })
  participantCount?: number;

  @ApiPropertyOptional({ description: 'Whether current user has joined' })
  userJoined?: boolean;

  @ApiPropertyOptional({ description: 'Whether current user completed it' })
  userCompleted?: boolean;
}

// Request DTO for creating challenges (admin)

export class CreateChallengeDTO {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsInt()
  pointsRewarded: number;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty()
  @IsString()
  teamId: string;
}
// Response DTO for user's challenge participation (US-18: Participate in challenges)
export class UserChallengeDTO {
  @ApiProperty()
  id: string;

  @ApiProperty()
  challengeId: string;

  @ApiProperty()
  challengeName: string;

  @ApiProperty()
  challengeDescription: string;

  @ApiProperty()
  pointsRewarded: number;

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;

  @ApiProperty()
  joinedAt: Date;

  @ApiProperty()
  completed: boolean;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiProperty({ description: 'Days remaining to complete' })
  daysRemaining: number;

  @ApiProperty({ description: 'Whether challenge is still active' })
  isActive: boolean;
}

// Response DTO for joining a challenge
export class JoinChallengeResponseDTO {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty()
  userChallenge: UserChallengeDTO;
}