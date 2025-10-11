import { ApiProperty, PartialType, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    IsEmail,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    MinLength
} from 'class-validator';
import { MatchesProperty } from '../../../core/common/validators/matches-property.validator';

export class CreateUserDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail({}, { message: 'Please provide a valid email address' })
    @Transform(({ value }) => value.toLowerCase().trim())
    email: string;

    @ApiProperty({ example: 'John Doe' })
    @IsString({ message: 'Name must be a string' })
    @MinLength(2, { message: 'Name must be at least 2 characters long' })
    @MaxLength(50, { message: 'Name cannot exceed 50 characters' })
    @Transform(({ value }) => value.trim())
    name: string;

    @ApiProperty({
        example: 'StrongPass123!',
        description:
            'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number and one special character'
    })
    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    @MaxLength(32, { message: 'Password cannot exceed 32 characters' })
    @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
        message: 'Password is too weak'
    })
    password: string;

    @ApiProperty({ required: false, example: 'image.jpg' })
    @IsOptional()
    @Transform(({ value }) => value?.trim())
    profilePicture?: string;
}

export class UpdateUserDto extends PartialType(
    OmitType(CreateUserDto, ['profilePicture', 'password'] as const)
) {
    @ApiProperty({ required: false, example: 'Bio goes here' })
    @IsOptional()
    @IsString({ message: 'Bio must be a string' })
    @MaxLength(160, { message: 'Bio cannot exceed 160 characters' })
    @Transform(({ value }) => value?.trim())
    bio?: string;
}

export class ChangePasswordDto {
    @ApiProperty({
        example: 'CurrentPass123!',
        description: 'Current password for verification'
    })
    @IsString({ message: 'Current password must be a string' })
    currentPassword: string;

    @ApiProperty({
        example: 'NewStrongPass123!',
        description:
            'New password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number and one special character'
    })
    @IsString()
    @MinLength(8, {
        message: 'New password must be at least 8 characters long'
    })
    @MaxLength(32, { message: 'New password cannot exceed 32 characters' })
    @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
        message: 'New password is too weak'
    })
    newPassword: string;

    @ApiProperty({
        example: 'NewStrongPass123!',
        description: 'Confirm the new password'
    })
    @IsString({ message: 'Password confirmation must be a string' })
    @MatchesProperty('newPassword', {
        message: 'Password confirmation must match new password'
    })
    confirmPassword: string;
}

export class UpdateProfileImageDto {
    @ApiProperty({
        type: 'string',
        format: 'binary',
        description: 'Profile image file (max 5MB)',
        required: true
    })
    profileImage: any;
}
