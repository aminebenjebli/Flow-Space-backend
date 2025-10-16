import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TeamAccessService } from './team-access.service';
import { PrismaService } from '../../core/services/prisma.service';
import { TeamRole } from '@prisma/client';

describe('TeamAccessService', () => {
    let service: TeamAccessService;
    let prismaService: PrismaService;

    const mockPrismaService = {
        teamMember: {
            findUnique: jest.fn(),
        },
        project: {
            findUnique: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TeamAccessService,
                {
                    provide: PrismaService,
                    useValue: mockPrismaService,
                },
            ],
        }).compile();

        service = module.get<TeamAccessService>(TeamAccessService);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('assertMember', () => {
        it('should pass when user is a member', async () => {
            mockPrismaService.teamMember.findUnique.mockResolvedValue({
                id: 'member1',
                teamId: 'team1',
                userId: 'user1',
                role: TeamRole.MEMBER,
            });

            await expect(
                service.assertMember('user1', 'team1')
            ).resolves.not.toThrow();
        });

        it('should throw ForbiddenException when user is not a member', async () => {
            mockPrismaService.teamMember.findUnique.mockResolvedValue(null);

            await expect(
                service.assertMember('user1', 'team1')
            ).rejects.toThrow(ForbiddenException);
        });
    });

    describe('assertAdmin', () => {
        it('should pass when user is an OWNER', async () => {
            mockPrismaService.teamMember.findUnique.mockResolvedValue({
                id: 'member1',
                teamId: 'team1',
                userId: 'user1',
                role: TeamRole.OWNER,
            });

            await expect(
                service.assertAdmin('user1', 'team1')
            ).resolves.not.toThrow();
        });

        it('should pass when user is an ADMIN', async () => {
            mockPrismaService.teamMember.findUnique.mockResolvedValue({
                id: 'member1',
                teamId: 'team1',
                userId: 'user1',
                role: TeamRole.ADMIN,
            });

            await expect(
                service.assertAdmin('user1', 'team1')
            ).resolves.not.toThrow();
        });

        it('should throw ForbiddenException when user is only a MEMBER', async () => {
            mockPrismaService.teamMember.findUnique.mockResolvedValue({
                id: 'member1',
                teamId: 'team1',
                userId: 'user1',
                role: TeamRole.MEMBER,
            });

            await expect(
                service.assertAdmin('user1', 'team1')
            ).rejects.toThrow(ForbiddenException);
        });

        it('should throw ForbiddenException when user is not a member', async () => {
            mockPrismaService.teamMember.findUnique.mockResolvedValue(null);

            await expect(
                service.assertAdmin('user1', 'team1')
            ).rejects.toThrow(ForbiddenException);
        });
    });

    describe('getTeamIdFromProject', () => {
        it('should return team ID when project exists', async () => {
            mockPrismaService.project.findUnique.mockResolvedValue({
                id: 'project1',
                teamId: 'team1',
            });

            const result = await service.getTeamIdFromProject('project1');
            expect(result).toBe('team1');
        });

        it('should throw NotFoundException when project does not exist', async () => {
            mockPrismaService.project.findUnique.mockResolvedValue(null);

            await expect(
                service.getTeamIdFromProject('project1')
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('isMember', () => {
        it('should return true when user is a member', async () => {
            mockPrismaService.teamMember.findUnique.mockResolvedValue({
                id: 'member1',
                teamId: 'team1',
                userId: 'user1',
                role: TeamRole.MEMBER,
            });

            const result = await service.isMember('user1', 'team1');
            expect(result).toBe(true);
        });

        it('should return false when user is not a member', async () => {
            mockPrismaService.teamMember.findUnique.mockResolvedValue(null);

            const result = await service.isMember('user1', 'team1');
            expect(result).toBe(false);
        });
    });

    describe('isAdmin', () => {
        it('should return true when user is OWNER', async () => {
            mockPrismaService.teamMember.findUnique.mockResolvedValue({
                id: 'member1',
                teamId: 'team1',
                userId: 'user1',
                role: TeamRole.OWNER,
            });

            const result = await service.isAdmin('user1', 'team1');
            expect(result).toBe(true);
        });

        it('should return true when user is ADMIN', async () => {
            mockPrismaService.teamMember.findUnique.mockResolvedValue({
                id: 'member1',
                teamId: 'team1',
                userId: 'user1',
                role: TeamRole.ADMIN,
            });

            const result = await service.isAdmin('user1', 'team1');
            expect(result).toBe(true);
        });

        it('should return false when user is MEMBER', async () => {
            mockPrismaService.teamMember.findUnique.mockResolvedValue({
                id: 'member1',
                teamId: 'team1',
                userId: 'user1',
                role: TeamRole.MEMBER,
            });

            const result = await service.isAdmin('user1', 'team1');
            expect(result).toBe(false);
        });

        it('should return false when user is not a member', async () => {
            mockPrismaService.teamMember.findUnique.mockResolvedValue(null);

            const result = await service.isAdmin('user1', 'team1');
            expect(result).toBe(false);
        });
    });
});