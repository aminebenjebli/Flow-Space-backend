import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { ConflictException } from '@nestjs/common';
import { TeamService } from './team.service';
import { TeamAccessService } from './team-access.service';
import { PrismaService } from '../../core/services/prisma.service';
import { TeamRole } from '@prisma/client';

describe('TeamService', () => {
    let service: TeamService;
    let prismaService: PrismaService;
    let teamAccessService: TeamAccessService;
    let configService: ConfigService;
    let mailerService: MailerService;

    const mockPrismaService = {
        team: {
            findFirst: jest.fn(),
            create: jest.fn(),
            findMany: jest.fn(),
        },
        teamMember: {
            create: jest.fn(),
        },
        $transaction: jest.fn(),
    };

    const mockTeamAccessService = {
        assertAdmin: jest.fn(),
        assertMember: jest.fn(),
    };

    const mockConfigService = {
        get: jest.fn(),
    };

    const mockMailerService = {
        sendMail: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TeamService,
                {
                    provide: PrismaService,
                    useValue: mockPrismaService,
                },
                {
                    provide: TeamAccessService,
                    useValue: mockTeamAccessService,
                },
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
                {
                    provide: MailerService,
                    useValue: mockMailerService,
                },
            ],
        }).compile();

        service = module.get<TeamService>(TeamService);
        prismaService = module.get<PrismaService>(PrismaService);
        teamAccessService = module.get<TeamAccessService>(TeamAccessService);
        configService = module.get<ConfigService>(ConfigService);
        mailerService = module.get<MailerService>(MailerService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createTeam', () => {
        const userId = 'user123';
        const createTeamDto = {
            name: 'Test Team',
            description: 'A test team',
        };

        it('should create a team successfully', async () => {
            const mockTeam = {
                id: 'team123',
                name: 'Test Team',
                description: 'A test team',
                createdAt: new Date(),
            };

            // Mock no existing team
            mockPrismaService.team.findFirst.mockResolvedValue(null);

            // Mock transaction success
            mockPrismaService.$transaction.mockImplementation(async (callback) => {
                return callback({
                    team: {
                        create: mockPrismaService.team.create.mockResolvedValue(mockTeam),
                    },
                    teamMember: {
                        create: mockPrismaService.teamMember.create.mockResolvedValue({
                            id: 'member123',
                            teamId: 'team123',
                            userId,
                            role: TeamRole.OWNER,
                        }),
                    },
                });
            });

            const result = await service.createTeam(userId, createTeamDto);

            expect(result).toEqual(mockTeam);
            expect(mockPrismaService.team.findFirst).toHaveBeenCalledWith({
                where: {
                    name: createTeamDto.name,
                    members: {
                        some: {
                            userId: userId,
                        },
                    },
                },
            });
        });

        it('should throw ConflictException when team name already exists for user', async () => {
            const existingTeam = {
                id: 'existing-team',
                name: 'Test Team',
                description: 'Existing team',
                createdAt: new Date(),
            };

            mockPrismaService.team.findFirst.mockResolvedValue(existingTeam);

            await expect(service.createTeam(userId, createTeamDto)).rejects.toThrow(
                ConflictException
            );
        });

        it('should create team with minimal data', async () => {
            const minimalDto = {
                name: 'Minimal Team',
            };

            const mockTeam = {
                id: 'team124',
                name: 'Minimal Team',
                description: null,
                createdAt: new Date(),
            };

            mockPrismaService.team.findFirst.mockResolvedValue(null);
            mockPrismaService.$transaction.mockImplementation(async (callback) => {
                return callback({
                    team: {
                        create: mockPrismaService.team.create.mockResolvedValue(mockTeam),
                    },
                    teamMember: {
                        create: mockPrismaService.teamMember.create.mockResolvedValue({
                            id: 'member124',
                            teamId: 'team124',
                            userId,
                            role: TeamRole.OWNER,
                        }),
                    },
                });
            });

            const result = await service.createTeam(userId, minimalDto);

            expect(result).toEqual(mockTeam);
            expect(mockPrismaService.team.create).toHaveBeenCalledWith({
                data: {
                    name: minimalDto.name,
                    description: undefined,
                },
            });
        });
    });

    describe('getMyTeams', () => {
        const userId = 'user123';

        it('should return user teams with members and projects', async () => {
            const mockTeams = [
                {
                    id: 'team1',
                    name: 'Team 1',
                    description: 'First team',
                    createdAt: new Date(),
                    members: [
                        {
                            user: {
                                id: 'user123',
                                name: 'John Doe',
                                email: 'john@example.com',
                            },
                            role: TeamRole.OWNER,
                            joinedAt: new Date(),
                        },
                    ],
                    projects: [
                        {
                            id: 'project1',
                            name: 'Project 1',
                            description: 'First project',
                            createdAt: new Date(),
                        },
                    ],
                },
            ];

            mockPrismaService.team.findMany.mockResolvedValue(mockTeams);

            const result = await service.getMyTeams(userId);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                id: 'team1',
                name: 'Team 1',
                description: 'First team',
                createdAt: mockTeams[0].createdAt,
                members: [
                    {
                        id: 'user123',
                        name: 'John Doe',
                        email: 'john@example.com',
                        role: TeamRole.OWNER,
                        joinedAt: mockTeams[0].members[0].joinedAt,
                    },
                ],
                projects: mockTeams[0].projects,
            });

            expect(mockPrismaService.team.findMany).toHaveBeenCalledWith({
                where: {
                    members: {
                        some: {
                            userId: userId,
                        },
                    },
                },
                include: {
                    members: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                },
                            },
                        },
                        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
                    },
                    projects: {
                        select: {
                            id: true,
                            name: true,
                            description: true,
                            createdAt: true,
                        },
                        orderBy: {
                            createdAt: 'desc',
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });
        });

        it('should return empty array when user has no teams', async () => {
            mockPrismaService.team.findMany.mockResolvedValue([]);

            const result = await service.getMyTeams(userId);

            expect(result).toEqual([]);
        });
    });
});