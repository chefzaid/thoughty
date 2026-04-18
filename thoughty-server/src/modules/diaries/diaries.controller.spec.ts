import { Test, TestingModule } from '@nestjs/testing';
import { DiariesController } from './diaries.controller';
import { DiariesService } from './diaries.service';

describe('DiariesController', () => {
  let controller: DiariesController;
  let diariesService: any;

  const mockUser = { userId: 1, email: 'test@example.com' };

  beforeEach(async () => {
    diariesService = {
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      setDefault: jest.fn(),
      reorder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DiariesController],
      providers: [{ provide: DiariesService, useValue: diariesService }],
    }).compile();

    controller = module.get<DiariesController>(DiariesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('delegates to diariesService.findAll with userId', async () => {
      const expected = [{ id: 1, name: 'My Diary' }];
      diariesService.findAll!.mockResolvedValue(expected as any);

      const result = await controller.findAll(mockUser as any);
      expect(diariesService.findAll).toHaveBeenCalledWith(1);
      expect(result).toBe(expected);
    });
  });

  describe('create', () => {
    it('delegates to diariesService.create with userId and dto', async () => {
      const dto = { name: 'New Diary' } as any;
      const expected = { id: 2, name: 'New Diary' };
      diariesService.create!.mockResolvedValue(expected as any);

      const result = await controller.create(mockUser as any, dto);
      expect(diariesService.create).toHaveBeenCalledWith(1, dto);
      expect(result).toBe(expected);
    });
  });

  describe('update', () => {
    it('delegates to diariesService.update with userId, id, and dto', async () => {
      const dto = { name: 'Updated Diary' } as any;
      const expected = { id: 5, name: 'Updated Diary' };
      diariesService.update!.mockResolvedValue(expected as any);

      const result = await controller.update(mockUser as any, 5, dto);
      expect(diariesService.update).toHaveBeenCalledWith(1, 5, dto);
      expect(result).toBe(expected);
    });
  });

  describe('delete', () => {
    it('delegates to diariesService.delete with userId and id', async () => {
      const expected = { success: true };
      diariesService.delete!.mockResolvedValue(expected);

      const result = await controller.delete(mockUser as any, 3);
      expect(diariesService.delete).toHaveBeenCalledWith(1, 3);
      expect(result).toBe(expected);
    });
  });

  describe('setDefault', () => {
    it('delegates to diariesService.setDefault with userId and id', async () => {
      const expected = { id: 2, name: 'Diary', isDefault: true };
      diariesService.setDefault!.mockResolvedValue(expected as any);

      const result = await controller.setDefault(mockUser as any, 2);
      expect(diariesService.setDefault).toHaveBeenCalledWith(1, 2);
      expect(result).toBe(expected);
    });
  });

  describe('reorder', () => {
    it('delegates to diariesService.reorder with userId and orderedIds', async () => {
      const expected = { success: true };
      diariesService.reorder!.mockResolvedValue(expected);

      const result = await controller.reorder(mockUser as any, { orderedIds: [3, 1, 2] });
      expect(diariesService.reorder).toHaveBeenCalledWith(1, [3, 1, 2]);
      expect(result).toEqual(expected);
    });
  });
});
