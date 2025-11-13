import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';

@Controller()
export class AppController {
    @Get()
    @ApiExcludeEndpoint()
    getRoot() {
        return {
            name: 'FlowSpace API',
            version: '1.0',
            status: 'running',
            timestamp: new Date().toISOString(),
            endpoints: {
                health: '/api/v1/health',
                docs: '/api/docs',
                api: '/api/v1'
            },
            message:
                'Welcome to FlowSpace API. Visit /api/docs for documentation.'
        };
    }
}
