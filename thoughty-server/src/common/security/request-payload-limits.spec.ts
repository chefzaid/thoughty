import express, { json } from 'express';
import request from 'supertest';
import {
  DEFAULT_FORM_BODY_LIMIT,
  DEFAULT_IMPORT_JSON_BODY_LIMIT,
  DEFAULT_JSON_BODY_LIMIT,
  getRequestPayloadLimits,
  useImportBodyParser,
} from './request-payload-limits';

describe('getRequestPayloadLimits', () => {
  it('uses conservative defaults when no overrides are provided', () => {
    expect(getRequestPayloadLimits({})).toEqual({
      json: DEFAULT_JSON_BODY_LIMIT,
      urlencoded: DEFAULT_FORM_BODY_LIMIT,
      importJson: DEFAULT_IMPORT_JSON_BODY_LIMIT,
    });
  });

  it('applies the shared body limit to JSON and form parsers', () => {
    expect(getRequestPayloadLimits({ REQUEST_BODY_LIMIT: '2mb' })).toEqual({
      json: '2mb',
      urlencoded: '2mb',
      importJson: DEFAULT_IMPORT_JSON_BODY_LIMIT,
    });
  });

  it('lets parser-specific limits override the shared body limit', () => {
    expect(
      getRequestPayloadLimits({
        REQUEST_BODY_LIMIT: '2mb',
        REQUEST_JSON_BODY_LIMIT: '4 MB',
        REQUEST_FORM_BODY_LIMIT: '128 KB',
        REQUEST_IMPORT_BODY_LIMIT: '12mb',
      }),
    ).toEqual({
      json: '4mb',
      urlencoded: '128kb',
      importJson: '12mb',
    });
  });

  it('falls back to defaults for invalid limit strings', () => {
    expect(
      getRequestPayloadLimits({
        REQUEST_JSON_BODY_LIMIT: 'forever',
        REQUEST_FORM_BODY_LIMIT: '-1mb',
      }),
    ).toEqual({
      json: DEFAULT_JSON_BODY_LIMIT,
      urlencoded: DEFAULT_FORM_BODY_LIMIT,
      importJson: DEFAULT_IMPORT_JSON_BODY_LIMIT,
    });
  });
});

describe('useImportBodyParser', () => {
  const app = express();
  useImportBodyParser(app, DEFAULT_IMPORT_JSON_BODY_LIMIT);
  app.use(json({ limit: DEFAULT_JSON_BODY_LIMIT }));
  app.post('*path', (req, res) => {
    res.json({ length: (req.body as { content: string }).content.length });
  });
  const twoMegabyteFile = { content: 'x'.repeat(2 * 1024 * 1024) };

  it.each(['/api/io/preview', '/api/io/import'])('lets %s receive a text file larger than the default JSON limit', async (path) => {
    const response = await request(app).post(path).send(twoMegabyteFile);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ length: twoMegabyteFile.content.length });
  });

  it('keeps the default JSON limit on every other route', async () => {
    const response = await request(app).post('/api/entries').send(twoMegabyteFile);

    expect(response.status).toBe(413);
  });
});
