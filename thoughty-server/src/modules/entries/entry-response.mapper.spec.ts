import type { Attachment, Diary, Entry } from '@/database/entities';
import { toEntryResponse } from './entry-response.mapper';

const entity = (fields: Partial<Entry> = {}) =>
  ({
    id: 7,
    userId: 3,
    diaryId: 2,
    date: '2026-10-21',
    index: 2,
    title: 'Harbor',
    timeOfDay: '08:30',
    mood: 4,
    feelings: ['calm'],
    tags: ['walks'],
    content: 'Walked by the harbor.',
    format: 'markdown',
    visibility: 'public',
    isFavorite: true,
    isArchived: false,
    isPinned: true,
    createdAt: new Date('2026-10-21T08:30:00Z'),
    ...fields,
  }) as Entry;

describe('toEntryResponse', () => {
  it('sends every field in snake_case with the joined diary', () => {
    const diary = { name: 'Travel', icon: '✈️', color: '#2A9D8F' } as Diary;

    expect(toEntryResponse(entity({ diary }))).toEqual({
      id: 7,
      user_id: 3,
      diary_id: 2,
      date: '2026-10-21',
      index: 2,
      title: 'Harbor',
      time_of_day: '08:30',
      mood: 4,
      feelings: ['calm'],
      tags: ['walks'],
      content: 'Walked by the harbor.',
      format: 'markdown',
      visibility: 'public',
      is_favorite: true,
      is_archived: false,
      is_pinned: true,
      diary_name: 'Travel',
      diary_icon: '✈️',
      diary_color: '#2A9D8F',
      created_at: new Date('2026-10-21T08:30:00Z'),
      sealed_until: null,
    });
  });

  it('fills unset optional fields and leaves out relations that were not loaded', () => {
    const response = toEntryResponse(
      entity({ title: undefined, timeOfDay: undefined, mood: undefined, feelings: undefined, diary: null }) as Entry,
    );

    expect(response).toEqual(expect.objectContaining({ title: null, time_of_day: null, mood: null, feelings: [] }));
    expect(response.diary_name).toBeUndefined();
    expect(response).not.toHaveProperty('attachments');
  });

  it('shows a sealed time capsule only by its date, diary, flags and opening time', () => {
    const sealedUntil = new Date('2030-01-01T08:00:00Z');
    const attachment = { id: 5, originalFilename: 'letter.jpg' } as Attachment;

    const response = toEntryResponse(entity({ sealedUntil, attachments: [attachment] }));

    expect(response).toEqual(expect.objectContaining({
      id: 7,
      date: '2026-10-21',
      time_of_day: '08:30',
      is_favorite: true,
      title: null,
      content: '',
      tags: [],
      mood: null,
      feelings: [],
      attachments: [],
      sealed_until: sealedUntil,
    }));
    expect(toEntryResponse(entity({ sealedUntil }))).not.toHaveProperty('attachments');
  });

  it('sends loaded attachments in the API shape', () => {
    const attachment = {
      id: 5,
      originalFilename: 'harbor.jpg',
      storedFilename: 'abc.jpg',
      mimetype: 'image/jpeg',
      size: 1024,
      transcript: null,
      transcribedAt: null,
    } as Attachment;

    expect(toEntryResponse(entity({ attachments: [attachment] })).attachments).toEqual([
      {
        id: 5,
        original_filename: 'harbor.jpg',
        stored_filename: 'abc.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        transcript: undefined,
        transcribed_at: undefined,
      },
    ]);
  });
});
