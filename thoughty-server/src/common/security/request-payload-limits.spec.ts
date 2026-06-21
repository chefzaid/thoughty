import {
  DEFAULT_FORM_BODY_LIMIT,
  DEFAULT_JSON_BODY_LIMIT,
  getRequestPayloadLimits,
} from './request-payload-limits';

describe('getRequestPayloadLimits', () => {
  it('uses conservative defaults when no overrides are provided', () => {
    expect(getRequestPayloadLimits({})).toEqual({
      json: DEFAULT_JSON_BODY_LIMIT,
      urlencoded: DEFAULT_FORM_BODY_LIMIT,
    });
  });

  it('applies the shared body limit to JSON and form parsers', () => {
    expect(getRequestPayloadLimits({ REQUEST_BODY_LIMIT: '2mb' })).toEqual({
      json: '2mb',
      urlencoded: '2mb',
    });
  });

  it('lets parser-specific limits override the shared body limit', () => {
    expect(
      getRequestPayloadLimits({
        REQUEST_BODY_LIMIT: '2mb',
        REQUEST_JSON_BODY_LIMIT: '4 MB',
        REQUEST_FORM_BODY_LIMIT: '128 KB',
      }),
    ).toEqual({
      json: '4mb',
      urlencoded: '128kb',
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
    });
  });
});
