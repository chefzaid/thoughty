import { EntriesCommandService } from './entries-command.service';

/** The `EntriesCommandService` under test and the collaborator mocks behind it. */
export interface EntriesCommandTestBed {
  service: EntriesCommandService;
  entryRepository: Record<string, jest.Mock>;
  revisionRepository: Record<string, jest.Mock>;
  diaryRepository: Record<string, jest.Mock>;
  entryTaggingService: Record<string, jest.Mock>;
  configService: Record<string, jest.Mock>;
  entryMentions: Record<string, jest.Mock>;
  timeCapsules: Record<string, jest.Mock>;
}

/**
 * A fresh `EntriesCommandService` over repository mocks. Tagging keeps no tags and the pinned
 * entry limit is 3 until a spec changes them.
 */
export function createEntriesCommandTestBed(): EntriesCommandTestBed {
  const entryRepository = {
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
    update: jest.fn(),
  };

  const revisionRepository = {
    findOne: jest.fn(),
    remove: jest.fn(),
    save: jest.fn(),
  };

  const diaryRepository = {
    findOne: jest.fn(),
  };

  const entryTaggingService = {
    resolveSavedTags: jest.fn().mockResolvedValue([]),
  };

  const configService = {
    getConfig: jest.fn().mockResolvedValue({ maxPinnedEntries: '3' }),
  };

  // Saving with mentions saves through the entry repository, so specs read what was saved there
  const entryMentions = {
    save: jest.fn((_userId: number, value: unknown) => entryRepository.save(value)),
  };

  const timeCapsules = {
    createSealed: jest.fn(async (_userId: number, written: object) => ({ id: 99, ...written })),
  };

  const service = new EntriesCommandService(
    entryRepository as never,
    revisionRepository as never,
    diaryRepository as never,
    entryTaggingService as never,
    configService as never,
    entryMentions as never,
    timeCapsules as never,
  );

  return { service, entryRepository, revisionRepository, diaryRepository, entryTaggingService, configService, entryMentions, timeCapsules };
}
