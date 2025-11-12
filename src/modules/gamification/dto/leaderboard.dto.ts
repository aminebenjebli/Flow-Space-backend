import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';


export class LeaderboardEntryDTO {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  username: string;

  @ApiPropertyOptional()
  profilePicture?: string;

  @ApiProperty({ description: 'Total points accumulated' })
  totalPoints: number;

  @ApiProperty({ description: 'Current level' })
  level: number;

  @ApiProperty({ description: 'Rank position (1 = first place)' })
  rank: number;

  @ApiProperty({ description: 'Total tasks completed' })
  tasksCompleted: number;

  @ApiProperty({ description: 'Current streak in days' })
  currentStreak: number;
}

// Response DTO for global leaderboard
export class GlobalLeaderboardDTO {
  @ApiProperty({ type: [LeaderboardEntryDTO] })
  entries: LeaderboardEntryDTO[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  lastUpdated: Date;
}


export class TeamLeaderboardDTO {
  @ApiProperty()
  teamId: string;

  @ApiProperty()
  teamName: string;

  @ApiProperty({ type: [LeaderboardEntryDTO] })
  entries: LeaderboardEntryDTO[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  lastUpdated: Date;
}


export class UserRankDTO {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  globalRank: number;

  @ApiProperty()
  totalUsers: number;

  @ApiProperty()
  totalPoints: number;

  @ApiProperty()
  level: number;

  @ApiProperty({ description: 'Points needed to reach next level' })
  pointsToNextLevel: number;
}