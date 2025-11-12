import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min, Max } from 'class-validator';

export class PaginationDto {
    @ApiProperty({
        description: 'Page number',
        example: 1,
        required: false,
        default: 1,
        minimum: 1
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiProperty({
        description: 'Number of items per page',
        example: 5,
        required: false,
        default: 5,
        minimum: 1,
        maximum: 100
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 5;
}

export class PaginationMetaDto {
    @ApiProperty({ example: 1, description: 'Current page number' })
    page: number;

    @ApiProperty({ example: 5, description: 'Items per page' })
    limit: number;

    @ApiProperty({ example: 50, description: 'Total number of items' })
    total: number;

    @ApiProperty({ example: 10, description: 'Total number of pages' })
    totalPages: number;

    @ApiProperty({ example: true, description: 'Whether there is a next page' })
    hasNextPage: boolean;

    @ApiProperty({ example: false, description: 'Whether there is a previous page' })
    hasPreviousPage: boolean;
}

export class PaginatedResponseDto<T> {
    @ApiProperty({ description: 'Array of items' })
    data: T[];

    @ApiProperty({ type: PaginationMetaDto, description: 'Pagination metadata' })
    meta: PaginationMetaDto;
}

export function createPaginationMeta(
    page: number,
    limit: number,
    total: number
): PaginationMetaDto {
    const totalPages = Math.ceil(total / limit);
    
    return {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
    };
}
