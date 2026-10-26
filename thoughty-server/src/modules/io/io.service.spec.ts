import { IoService } from './io.service';
import { createIoServiceTestBed } from './io.test-helpers';

describe('IoService', () => {
  let service: IoService;
  let settingRepository: any;

  beforeEach(async () => {
    ({ service, settingRepository } = await createIoServiceTestBed());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getFormat', () => {
    it('should return format config with defaults', async () => {
      settingRepository.find.mockResolvedValue([]);

      const result = await service.getFormat(1);

      expect(result).toHaveProperty('entrySeparator');
      expect(result).toHaveProperty('dateFormat');
      expect(result).toHaveProperty('tagOpenBracket');
      expect(result).toHaveProperty('tagCloseBracket');
    });

    it('should merge user settings with defaults', async () => {
      settingRepository.find.mockResolvedValue([
        { key: 'io_entrySeparator', value: '====' },
      ]);

      const result = await service.getFormat(1);

      expect(result.entrySeparator).toBe('====');
      expect(result.dateFormat).toBe('YYYY-MM-DD'); // default
    });
  });

  describe('saveFormat', () => {
    it('should save format config', async () => {
      settingRepository.upsert.mockResolvedValue({});

      const result = await service.saveFormat(1, {
        entrySeparator: '====',
        dateFormat: 'DD-MM-YYYY',
      });

      expect(result.success).toBe(true);
      expect(result.config).toBeDefined();
      expect(settingRepository.upsert).toHaveBeenCalled();
    });

    it('should call upsert for each config key', async () => {
      settingRepository.upsert.mockResolvedValue({});

      await service.saveFormat(1, {
        entrySeparator: '====',
        dateFormat: 'DD-MM-YYYY',
        tagOpenBracket: '(',
        tagCloseBracket: ')',
      });

      expect(settingRepository.upsert).toHaveBeenCalledTimes(9); // All config keys
    });
  });
});
