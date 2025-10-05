import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class ResendOtpDto {
    @IsNotEmpty({ message: 'Email is required' })
    @IsEmail({}, { message: 'Please provide a valid email' })
    @ApiProperty({ example: 'user@example.com' })
    email: string;

    @IsOptional()
    @IsIn(['verify', 'reset'], {
        message: 'Type must be either "verify" or "reset"'
    })
    @ApiProperty({
        example: 'verify',
        enum: ['verify', 'reset'],
        default: 'verify',
        required: false,
        description:
            'Type of OTP to resend: verify for email verification, reset for password reset'
    })
    type?: 'verify' | 'reset' = 'verify';
}
