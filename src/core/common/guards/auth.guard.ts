import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { TokenBlacklistService } from '../../services/token-blacklist.service';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly tokenBlacklistService: TokenBlacklistService
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const token = this.extractTokenFromHeader(request);
        if (!token) {
            throw new UnauthorizedException();
        }

        try {
            // Check if token is blacklisted
            const isBlacklisted =
                await this.tokenBlacklistService.isTokenBlacklisted(token);
            if (isBlacklisted) {
                throw new UnauthorizedException('Token has been invalidated');
            }

            const JWT_SECRET = this.configService.get('JWT_SECRET', 'secret');

            const payload = await this.jwtService.verifyAsync(token, {
                secret: JWT_SECRET
            });
            request['user'] = payload;
        } catch (error) {
            if (error.message === 'Token has been invalidated') {
                throw new UnauthorizedException('Token has been invalidated');
            }
            throw new UnauthorizedException();
        }

        return true;
    }

    private extractTokenFromHeader(request: Request): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
}
