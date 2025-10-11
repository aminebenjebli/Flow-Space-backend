import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    UploadedFile,
    UseInterceptors,
    UseGuards
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
    ApiCreatedResponse,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
    ApiConsumes,
    ApiBody,
    ApiBearerAuth
} from '@nestjs/swagger';
import { User } from '@prisma/client';
import {
    CreateUserDto,
    UpdateUserDto,
    UpdateProfileImageDto,
    ChangePasswordDto
} from './dto/user.dto';
import { UserService } from './user.service';
import { ImageValidationPipe } from '../../core/common/pipes/image-validation.pipe';
import { AuthGuard } from '../../core/common/guards/auth.guard';

@ApiTags('Users')
@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Post()
    @ApiOperation({
        summary: 'Create new user',
        description: 'Creates a new user with the provided data'
    })
    @ApiCreatedResponse({
        description: 'User has been created successfully'
    })
    create(@Body() createUserDto: CreateUserDto): Promise<User> {
        return this.userService.create(createUserDto);
    }

    @Get()
    @ApiOperation({
        summary: 'Get all users',
        description: 'Retrieves a list of all registered users'
    })
    @ApiOkResponse({ description: 'List of all users' })
    findAll(): Promise<User[]> {
        return this.userService.findAll();
    }

    @Get(':id')
    @ApiOperation({
        summary: 'Get user by id',
        description: 'Retrieves a specific user by their unique identifier'
    })
    @ApiOkResponse({ description: 'User found' })
    findOne(@Param('id') id: string): Promise<User> {
        return this.userService.findOne(id);
    }

    @Patch(':id')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'Update user',
        description: "Updates an existing user's information"
    })
    @ApiOkResponse({
        description: 'User has been updated successfully'
    })
    update(
        @Param('id') id: string,
        @Body() updateUserDto: UpdateUserDto
    ): Promise<User> {
        return this.userService.update(id, updateUserDto);
    }

    @Delete(':id')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'Delete user',
        description: 'Removes a user from the system'
    })
    @ApiOkResponse({
        description: 'User has been deleted successfully'
    })
    remove(@Param('id') id: string): Promise<User> {
        return this.userService.remove(id);
    }

    @Post(':id/profile-image')
    @UseGuards(AuthGuard)
    @UseInterceptors(FileInterceptor('profileImage'))
    @ApiOperation({
        summary: 'Update user profile image',
        description: 'Uploads and sets a new profile image for the user'
    })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        description: 'Profile image file',
        type: UpdateProfileImageDto
    })
    @ApiBearerAuth()
    @ApiOkResponse({
        description: 'Profile image updated successfully'
    })
    async updateProfileImage(
        @Param('id') id: string,
        @UploadedFile(new ImageValidationPipe()) file: Express.Multer.File
    ): Promise<User> {
        return this.userService.updateProfileImage(id, file);
    }

    @Delete(':id/profile-image')
    @UseGuards(AuthGuard)
    @ApiOperation({
        summary: 'Remove user profile image',
        description: 'Removes the current profile image of the user'
    })
    @ApiBearerAuth()
    @ApiOkResponse({
        description: 'Profile image removed successfully'
    })
    async removeProfileImage(@Param('id') id: string): Promise<User> {
        return this.userService.removeProfileImage(id);
    }

    @Patch(':id/change-password')
    @UseGuards(AuthGuard)
    @ApiOperation({
        summary: 'Change user password',
        description: 'Changes the password for the authenticated user'
    })
    @ApiBearerAuth()
    @ApiOkResponse({
        description: 'Password changed successfully',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Password changed successfully'
                }
            }
        }
    })
    async changePassword(
        @Param('id') id: string,
        @Body() changePasswordDto: ChangePasswordDto
    ): Promise<{ message: string }> {
        return this.userService.changePassword(id, changePasswordDto);
    }
}
