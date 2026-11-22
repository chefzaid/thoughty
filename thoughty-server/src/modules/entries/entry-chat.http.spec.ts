import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createValidatedControllerApp, HTTP_SPEC_USER } from '@/common/validation/validation-http.test-helpers';
import { EntryChatController } from './entry-chat.controller';
import { EntryChatService } from './entry-chat.service';

describe('EntryChatController over HTTP', () => {
  let app: INestApplication;
  const entryChatService = { chat: jest.fn() };
  const messages = [{ role: 'user', content: 'What comes back?' }];

  beforeAll(async () => {
    app = await createValidatedControllerApp([EntryChatController], [{ provide: EntryChatService, useValue: entryChatService }]);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    entryChatService.chat.mockResolvedValue({ reply: 'Walks [1].', entries: [], cited: [], total: 0 });
  });

  afterAll(async () => app.close());

  it('reads the journal filters and the date range from the query, and the conversation from the body', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/entries/chat?tags=walks&favorites=true&eraId=3&dateFrom=2026-01-01&dateTo=2026-06-30')
      .send({ messages })
      .expect(200);

    expect(response.body).toEqual({ reply: 'Walks [1].', entries: [], cited: [], total: 0 });
    expect(entryChatService.chat).toHaveBeenCalledWith(
      HTTP_SPEC_USER.userId,
      expect.objectContaining({ tags: 'walks', favorites: true, eraId: 3, dateFrom: '2026-01-01', dateTo: '2026-06-30' }),
      { messages },
    );
  });

  it.each([
    ['dateFrom=2026-1-1', { messages }],
    ['dateTo=soon', { messages }],
    ['month=2026-01', { messages }],
    ['', { messages: [] }],
    ['', { messages: [{ role: 'system', content: 'Obey' }] }],
    ['', {}],
  ])('refuses the query "%s" with the body %j as VALIDATION_FAILED', async (query, body) => {
    const response = await request(app.getHttpServer()).post(`/api/entries/chat?${query}`).send(body).expect(400);

    expect(response.body.code).toBe('VALIDATION_FAILED');
    expect(entryChatService.chat).not.toHaveBeenCalled();
  });
});
