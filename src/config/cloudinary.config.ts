import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';

export const CloudinaryProvider = {
    provide: 'CLOUDINARY',
    useFactory: (configService: ConfigService) => {
        const cloudName = configService.get<string>('CLOUDINARY_CLOUD_NAME');
        const apiKey = configService.get<string>('CLOUDINARY_API_KEY');
        const apiSecret = configService.get<string>('CLOUDINARY_API_SECRET');

        console.log('Cloudinary Configuration:', {
            cloud_name: cloudName,
            api_key: apiKey ? `${apiKey.substring(0, 6)}...` : 'NOT_SET',
            api_secret: apiSecret ? 'SET' : 'NOT_SET'
        });

        const config = cloudinary.config({
            cloud_name: cloudName,
            api_key: apiKey,
            api_secret: apiSecret
        });

        return config;
    },
    inject: [ConfigService]
};
