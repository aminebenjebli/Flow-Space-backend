import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
    async uploadImage(
        file: Express.Multer.File,
        folder: string = 'profile-pictures'
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            console.log('Attempting to upload image to Cloudinary...');
            console.log('File details:', {
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                folder: folder
            });

            const upload = cloudinary.uploader.upload_stream(
                {
                    folder: folder,
                    resource_type: 'auto',
                    transformation: [
                        { width: 500, height: 500, crop: 'fill' },
                        { quality: 'auto' },
                        { format: 'webp' }
                    ]
                },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary upload error:', error);
                        return reject(
                            new Error(
                                `Cloudinary upload failed: ${error.message}`
                            )
                        );
                    }
                    console.log('Cloudinary upload successful:', {
                        public_id: result.public_id,
                        secure_url: result.secure_url
                    });
                    resolve(result);
                }
            );

            const stream = Readable.from(file.buffer);
            stream.pipe(upload);
        });
    }

    async deleteImage(publicId: string): Promise<any> {
        return cloudinary.uploader.destroy(publicId);
    }

    async updateImage(
        file: Express.Multer.File,
        oldPublicId?: string,
        folder: string = 'profile-pictures'
    ): Promise<any> {
        // Delete old image if exists
        if (oldPublicId) {
            try {
                await this.deleteImage(oldPublicId);
            } catch (error) {
                console.warn('Failed to delete old image:', error);
            }
        }

        // Upload new image
        return this.uploadImage(file, folder);
    }

    extractPublicId(cloudinaryUrl: string): string | null {
        try {
            const matches = cloudinaryUrl.match(
                /\/([^\/]+)\.(jpg|jpeg|png|gif|webp)$/
            );
            return matches ? matches[1] : null;
        } catch (error) {
            return null;
        }
    }
}
