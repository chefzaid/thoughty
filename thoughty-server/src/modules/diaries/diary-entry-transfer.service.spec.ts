import { DiaryEntryTransferService } from './diary-entry-transfer.service';

describe('DiaryEntryTransferService', () => {
  it('moves entries from one diary to another', async () => {
    const entryRepository = {
      update: jest.fn().mockResolvedValue({ affected: 3 }),
    };
    const service = new DiaryEntryTransferService(entryRepository);

    await service.moveEntriesToDiary(2, 8, 9);

    expect(entryRepository.update).toHaveBeenCalledWith({ diaryId: 8, userId: 2 }, { diaryId: 9 });
  });
});