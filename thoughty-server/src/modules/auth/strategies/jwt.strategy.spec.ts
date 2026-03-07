import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy, JwtPayload } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let configService: ConfigService;

  beforeEach(() => {
    configService = {
      get: jest.fn().mockReturnValue('test-secret'),
    } as unknown as ConfigService;

    strategy = new JwtStrategy(configService);
  });

  describe('constructor', () => {
    it('should get JWT_SECRET from config service', () => {
      expect(configService.get).toHaveBeenCalledWith('JWT_SECRET', 'your-secret-key-change-in-production');
    });
  });

  describe('validate', () => {
    it('should return payload for valid token', async () => {
      const payload: JwtPayload = {
        userId: 1,
        email: 'test@example.com',
        username: 'testuser',
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        userId: 1,
        email: 'test@example.com',
        username: 'testuser',
      });
    });

    it('should throw UnauthorizedException for missing userId', async () => {
      const payload = {
        email: 'test@example.com',
        username: 'testuser',
      } as unknown as JwtPayload;

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for null userId', async () => {
      const payload = {
        userId: null,
        email: 'test@example.com',
        username: 'testuser',
      } as unknown as JwtPayload;

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for zero userId', async () => {
      const payload: JwtPayload = {
        userId: 0,
        email: 'test@example.com',
        username: 'testuser',
      };

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });
  });
});
