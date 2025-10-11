import {
    ConflictException,
    Injectable,
    NotFoundException
} from '@nestjs/common';
import { User } from '@prisma/client';
import { BaseService } from '../../core/services/base.service';
import { PrismaService } from '../../core/services/prisma.service';
import { CloudinaryService } from '../../core/services/cloudinary.service';
import { cryptPassword, handleOtpOperation } from '../../core/utils/auth';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { MailerService } from '@nestjs-modules/mailer';
import {
    EmailSubject,
    EmailTemplate
} from 'src/core/constants/email.constants';

@Injectable()
export class UserService extends BaseService<
    User,
    CreateUserDto,
    UpdateUserDto
> {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly mailerService: MailerService,
        private readonly cloudinaryService: CloudinaryService
    ) {
        super(prismaService.user, 'User');
    }

    async create(createDto: CreateUserDto): Promise<User> {
        // Check if user already exists
        const existingUser = await this.prismaService.user.findUnique({
            where: { email: createDto.email }
        });

        if (existingUser) {
            throw new ConflictException('User with this email already exists');
        }

        // Préparer les données à insérer
        const userData: any = {
            ...createDto,
            password: await cryptPassword(createDto.password),
            isEmailVerified: false
        };

        const user = await this.prismaService.user.create({
            data: userData
        });

        // Generate and send OTP for verification
        await handleOtpOperation(
            this.prismaService,
            this.mailerService,
            createDto.email,
            {
                template: EmailTemplate.VERIFY_ACCOUNT,
                subject: EmailSubject.VERIFY_ACCOUNT
            }
        );

        return user;
    }

    async updateProfileImage(
        userId: string,
        file: Express.Multer.File
    ): Promise<User> {
        // Check if user exists
        const user = await this.prismaService.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Extract old image public ID for deletion
        let oldPublicId: string | null = null;
        if (user.profilePicture) {
            oldPublicId = this.cloudinaryService.extractPublicId(
                user.profilePicture
            );
        }

        try {
            // Upload new image to Cloudinary
            const uploadResult = await this.cloudinaryService.updateImage(
                file,
                oldPublicId,
                'profile-pictures'
            );

            // Update user with new profile picture URL
            const updatedUser = await this.prismaService.user.update({
                where: { id: userId },
                data: {
                    profilePicture: uploadResult.secure_url
                }
            });

            return updatedUser;
        } catch (error) {
            throw new Error(`Failed to update profile image: ${error.message}`);
        }
    }

    async removeProfileImage(userId: string): Promise<User> {
        // Check if user exists
        const user = await this.prismaService.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (!user.profilePicture) {
            throw new NotFoundException('User has no profile image to remove');
        }

        // Extract public ID for deletion
        const publicId = this.cloudinaryService.extractPublicId(
            user.profilePicture
        );

        try {
            // Delete image from Cloudinary
            if (publicId) {
                await this.cloudinaryService.deleteImage(publicId);
            }

            // Update user to remove profile picture URL
            const updatedUser = await this.prismaService.user.update({
                where: { id: userId },
                data: {
                    profilePicture: null
                }
            });

            return updatedUser;
        } catch (error) {
            throw new Error(`Failed to remove profile image: ${error.message}`);
        }
    }
}
