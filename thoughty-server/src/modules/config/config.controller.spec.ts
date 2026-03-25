import { Test, TestingModule } from '@nestjs/testing';
import { ConfigController } from './config.controller';
import { ConfigService } from './config.service';

describe('ConfigController', () => {
  let controller: ConfigController;
  let configService: any;

  const mockUser = { userId: 1, email: 'test@example.com' };

  beforeEach(async () => {
    configService = {
      getConfig: jest.fn(),
      updateConfig: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConfigController],
      providers: [{ provide: ConfigService, useValue: configService }],
    }).compile();

    controller = module.get<ConfigController>(ConfigController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getConfig', () => {
    it('delegates to configService.getConfig with userId', async () => {
      const expected = { theme: 'dark', name: 'User' };
      configService.getConfig!.mockResolvedValue(expected);

      const result = await controller.getConfig(mockUser as any);
      expect(configService.getConfig).toHaveBeenCalledWith(1);
      expect(result).toBe(expected);
    });
  });

  describe('updateConfig', () => {
    it('delegates to configService.updateConfig with userId and config', async () => {
      const newConfig = { theme: 'light', name: 'John' };
      const expected = { success: true };
      configService.updateConfig!.mockResolvedValue(expected);

      const result = await controller.updateConfig(mockUser as any, newConfig);
      expect(configService.updateConfig).toHaveBeenCalledWith(1, newConfig);
      expect(result).toBe(expected);
    });
  });
});
