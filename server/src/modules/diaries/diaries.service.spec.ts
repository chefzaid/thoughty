import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { DiariesService } from './diaries.service';
import { Diary, Entry } from '@/database/entities';

describe('DiariesService', () => {
  let service: DiariesService;
  let diaryRepository: any;
  let entryRepository: any;

  const mockDiary = {
    id: 1,
    userId: 1,
    name: 'Test Diary',
    icon: '📓',
    visibility: 'private',
    isDefault: false,
    createdAt: new Date(),
  };

  const mockDefaultDiary = {
    id: 2,
    userId: 1,
    name: 'Default Diary',
    icon: '💭',
    visibility: 'private',
    isDefault: true,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    diaryRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    };

    entryRepository = {
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiariesService,
        { provide: getRepositoryToken(Diary), useValue: diaryRepository },
        { provide: getRepositoryToken(Entry), useValue: entryRepository },
      ],
    }).compile();

    service = module.get<DiariesService>(DiariesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all diaries for user', async () => {
      diaryRepository.find.mockResolvedValue([mockDiary, mockDefaultDiary]);

      const result = await service.findAll(1);

      expect(result).toHaveLength(2);
      expect(diaryRepository.find).toHaveBeenCalledWith({
        where: { userId: 1 },
        order: { isDefault: 'DESC', createdAt: 'ASC' },
      });
    });

    it('should return empty array if no diaries', async () => {
      diaryRepository.find.mockResolvedValue([]);

      const result = await service.findAll(1);

      expect(result).toHaveLength(0);
    });
  });

  describe('create', () => {
    it('should create a new diary', async () => {
      diaryRepository.save.mockResolvedValue(mockDiary);

      const result = await service.create(1, {
        name: 'Test Diary',
        icon: '📓',
        visibility: 'private',
      });

      expect(result).toEqual(mockDiary);
      expect(diaryRepository.save).toHaveBeenCalledWith({
        userId: 1,
        name: 'Test Diary',
        icon: '📓',
        visibility: 'private',
        isDefault: false,
      });
    });

    it('should use default icon if not provided', async () => {
      diaryRepository.save.mockResolvedValue(mockDiary);

      await service.create(1, {
        name: 'Test Diary',
      });

      expect(diaryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: '📓',
        }),
      );
    });

    it('should use default visibility if invalid value provided', async () => {
      diaryRepository.save.mockResolvedValue(mockDiary);

      await service.create(1, {
        name: 'Test Diary',
        visibility: 'invalid' as any,
      });

      expect(diaryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: 'private',
        }),
      );
    });

    it('should throw ConflictException for duplicate name', async () => {
      diaryRepository.save.mockRejectedValue({ code: '23505' });

      await expect(
        service.create(1, {
          name: 'Duplicate Diary',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should rethrow other errors', async () => {
      const error = new Error('Database error');
      diaryRepository.save.mockRejectedValue(error);

      await expect(
        service.create(1, {
          name: 'Test Diary',
        }),
      ).rejects.toThrow('Database error');
    });

    it('should sanitize and truncate name', async () => {
      diaryRepository.save.mockResolvedValue(mockDiary);

      await service.create(1, {
        name: '  Test Diary  ',
      });

      expect(diaryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Diary',
        }),
      );
    });
  });

  describe('update', () => {
    it('should update existing diary', async () => {
      diaryRepository.findOne.mockResolvedValue(mockDiary);
      diaryRepository.save.mockResolvedValue({ ...mockDiary, name: 'Updated Diary' });

      const result = await service.update(1, 1, {
        name: 'Updated Diary',
        icon: '📓',
        visibility: 'public',
      });

      expect(result.name).toBe('Updated Diary');
    });

    it('should throw NotFoundException for non-existent diary', async () => {
      diaryRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update(1, 999, {
          name: 'Updated Diary',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should keep existing visibility if invalid value provided', async () => {
      const diaryWithPublicVisibility = { ...mockDiary, visibility: 'public' as const };
      diaryRepository.findOne.mockResolvedValue(diaryWithPublicVisibility);
      diaryRepository.save.mockResolvedValue(diaryWithPublicVisibility);

      await service.update(1, 1, {
        name: 'Updated Diary',
        visibility: 'invalid' as any,
      });

      // Should keep the existing visibility ('public') when invalid value is provided
      expect(diaryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: 'public',
        }),
      );
    });

    it('should throw ConflictException for duplicate name', async () => {
      diaryRepository.findOne.mockResolvedValue(mockDiary);
      diaryRepository.save.mockRejectedValue({ code: '23505' });

      await expect(
        service.update(1, 1, {
          name: 'Duplicate Diary',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should rethrow other errors', async () => {
      const error = new Error('Database error');
      diaryRepository.findOne.mockResolvedValue(mockDiary);
      diaryRepository.save.mockRejectedValue(error);

      await expect(
        service.update(1, 1, {
          name: 'Test Diary',
        }),
      ).rejects.toThrow('Database error');
    });
  });

  describe('delete', () => {
    it('should delete non-default diary', async () => {
      diaryRepository.findOne
        .mockResolvedValueOnce(mockDiary) // First call - find diary to delete
        .mockResolvedValueOnce(mockDefaultDiary); // Second call - find default diary
      entryRepository.update.mockResolvedValue({ affected: 5 });
      diaryRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.delete(1, 1);

      expect(result.success).toBe(true);
      expect(entryRepository.update).toHaveBeenCalledWith(
        { diaryId: 1, userId: 1 },
        { diaryId: mockDefaultDiary.id },
      );
    });

    it('should throw NotFoundException for non-existent diary', async () => {
      diaryRepository.findOne.mockResolvedValue(null);

      await expect(service.delete(1, 999)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when deleting default diary', async () => {
      diaryRepository.findOne.mockResolvedValue(mockDefaultDiary);

      await expect(service.delete(1, 2)).rejects.toThrow(BadRequestException);
    });

    it('should handle case when no default diary exists', async () => {
      diaryRepository.findOne
        .mockResolvedValueOnce(mockDiary)
        .mockResolvedValueOnce(null); // No default diary
      diaryRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.delete(1, 1);

      expect(result.success).toBe(true);
      expect(entryRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('setDefault', () => {
    it('should set diary as default', async () => {
      diaryRepository.findOne.mockResolvedValue(mockDiary);
      diaryRepository.update.mockResolvedValue({ affected: 2 });
      diaryRepository.save.mockResolvedValue({ ...mockDiary, isDefault: true });

      const result = await service.setDefault(1, 1);

      expect(result.isDefault).toBe(true);
      expect(diaryRepository.update).toHaveBeenCalledWith({ userId: 1 }, { isDefault: false });
    });

    it('should throw NotFoundException for non-existent diary', async () => {
      diaryRepository.findOne.mockResolvedValue(null);

      await expect(service.setDefault(1, 999)).rejects.toThrow(NotFoundException);
    });
  });
});
