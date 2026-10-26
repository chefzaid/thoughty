import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IoService } from './io.service';
import { Entry, Setting, Diary, User } from '@/database/entities';

export const mockEntry = {
  id: 1,
  userId: 1,
  diaryId: 1,
  date: '2024-01-15',
  index: 1,
  tags: ['tag1', 'tag2'],
  content: 'Test entry content',
  visibility: 'private',
};

export const mockDiary = {
  id: 1,
  userId: 1,
  name: 'Test Diary',
  icon: '📓',
  isDefault: true,
};

/**
 * A fresh `IoService` over repository mocks, returned with them. The entry repository hands out one shared query
 * builder that returns `mockEntry` until a spec changes it.
 */
export async function createIoServiceTestBed() {
  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([mockEntry]),
  };

  const entryRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  const settingRepository = {
    find: jest.fn(),
    upsert: jest.fn(),
  };

  const diaryRepository = {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
  };

  const userRepository = {
    findOne: jest.fn().mockResolvedValue({ id: 1, username: 'jane' }),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      IoService,
      { provide: getRepositoryToken(Entry), useValue: entryRepository },
      { provide: getRepositoryToken(Setting), useValue: settingRepository },
      { provide: getRepositoryToken(Diary), useValue: diaryRepository },
      { provide: getRepositoryToken(User), useValue: userRepository },
    ],
  }).compile();

  return {
    service: module.get<IoService>(IoService),
    entryRepository,
    settingRepository,
    diaryRepository,
    userRepository,
  };
}
