import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { createAuthServiceMocks, createAuthServices } from './auth-services.test-helpers';

describe('AuthService bot protection', () => {
  let service: AuthService;
  let userRepository: any;

  beforeEach(async () => {
    const mocks = createAuthServiceMocks();
    userRepository = mocks.userRepository;
    ({ auth: service } = await createAuthServices(mocks));
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
