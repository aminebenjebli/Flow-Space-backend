import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../../core/services/prisma.service';
import { CloudinaryService } from '../../core/services/cloudinary.service';
import { CloudinaryProvider } from '../../config/cloudinary.config';
import { AuthGuard } from '../../core/common/guards/auth.guard';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
    imports: [
        ConfigModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET', 'secret'),
                signOptions: { expiresIn: '1d' }
            })
        })
    ],
    controllers: [UserController],
    providers: [
        UserService,
        PrismaService,
        CloudinaryService,
        CloudinaryProvider,
        AuthGuard
    ]
})
export class UserModule {}
