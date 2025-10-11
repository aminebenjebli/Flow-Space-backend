import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ImageValidationPipe implements PipeTransform {
    private readonly allowedMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/gif'
    ];

    private readonly maxSize = 5 * 1024 * 1024; // 5MB

    transform(file: Express.Multer.File): Express.Multer.File {
        if (!file) {
            throw new BadRequestException('No file uploaded');
        }

        // Validate file type
        if (!this.allowedMimeTypes.includes(file.mimetype)) {
            throw new BadRequestException(
                `Invalid file type. Allowed types: ${this.allowedMimeTypes.join(', ')}`
            );
        }

        // Validate file size
        if (file.size > this.maxSize) {
            throw new BadRequestException(
                `File too large. Maximum size is ${this.maxSize / 1024 / 1024}MB`
            );
        }

        return file;
    }
}
