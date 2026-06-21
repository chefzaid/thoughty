import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Diary, RefreshToken, User } from '@/database/entities';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';

describe('AuthService bot protection', () => {
  let service: AuthService;
  let userRepository: any;

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(RefreshToken), useValue: { save: jest.fn(), findOne: jest.fn() } },
        { provide: getRepositoryToken(Diary), useValue: { save: jest.fn() } },
        { provide: JwtService, useValue: { sign: jest.fn(), verify: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('test-secret') } },
        {
          provide: EmailService,
          useValue: {
            sendPasswordResetEmail: jest.fn(),
            sendAccountDeletionEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects registration when the bot-trap field is filled', async () => {
    await expect(
      service.register({
        email: 'bot@example.com',
        password: 'Password123!',
        username: 'botuser',
        website: 'https://spam.example',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(userRepository.findOne).not.toHaveBeenCalled();
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('rejects login when the bot-trap field is filled', async () => {
    await expect(
      service.login({
        identifier: 'bot@example.com',
        password: 'Password123!',
        website: 'https://spam.example',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(userRepository.createQueryBuilder).not.toHaveBeenCalled();
  });
});
