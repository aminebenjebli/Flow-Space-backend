import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { WhisperController } from './whisper.controller';
import { WhisperService } from './whisper.service';
@Module({
    imports: [
        MulterModule.register({ storage: undefined }), // use memory storage by default when no disk storage provided
    ],
    controllers: [WhisperController],
    providers: [WhisperService],
    exports: [WhisperService],
})
export class WhisperModule {}
