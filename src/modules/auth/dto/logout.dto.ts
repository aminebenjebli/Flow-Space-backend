import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LogoutDto {
    @ApiProperty({
        description: 'Refresh token to blacklist (optional)',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        required: false
    })
    @IsOptional()
    @IsString()
    refreshToken?: string;
}
