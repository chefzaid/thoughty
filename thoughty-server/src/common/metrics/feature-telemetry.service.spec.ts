import { FeatureTelemetryService } from './feature-telemetry.service';

describe('FeatureTelemetryService', () => {
  it('records aggregate feature usage without preserving raw routes', () => {
    const service = new FeatureTelemetryService();

    service.record({ method: 'GET', path: '/api/entries/123?search=private', statusCode: 200 });
    service.record({ method: 'POST', path: '/api/entries', statusCode: 201 });
    service.record({ method: 'POST', path: '/api/ai/suggest-tags', statusCode: 200 });
    service.record({ method: 'GET', path: '/api/health', statusCode: 200 });
    service.record({ method: 'GET', path: '/api/metrics', statusCode: 200 });

    expect(service.getSnapshot()).toEqual([
      {
        feature: 'ai',
        action: 'suggest-tags',
        statusFamily: '2xx',
        count: 1,
      },
      {
        feature: 'journal_entries',
        action: 'create',
        statusFamily: '2xx',
        count: 1,
      },
      {
        feature: 'journal_entries',
        action: 'read',
        statusFamily: '2xx',
        count: 1,
      },
    ]);
  });

  it('ignores unknown routes and groups failures by status family', () => {
    const service = new FeatureTelemetryService();

    service.record({ method: 'POST', path: '/api/auth/login', statusCode: 401 });
    service.record({ method: 'POST', path: '/api/unknown', statusCode: 404 });

    expect(service.getSnapshot()).toEqual([
      {
        feature: 'auth',
        action: 'login',
        statusFamily: '4xx',
        count: 1,
      },
    ]);
  });
});
