import { attachErrorResponseSchema } from './swagger.errors';

describe('attachErrorResponseSchema', () => {
  it('gives each error response the error body with an example from its status', () => {
    const document = {
      paths: {
        '/api/auth/two-factor/verify': {
          parameters: [],
          post: {
            responses: {
              '200': { description: 'Signed in' },
              '401': { description: 'Invalid or expired code' },
              '418': {},
              '409': { description: 'Already documented', content: { 'text/plain': {} } },
            },
          },
        },
      },
    };

    const result = attachErrorResponseSchema(document);
    const { responses } = result.paths['/api/auth/two-factor/verify'].post;

    expect(result).toBe(document);
    expect(responses['200']).toEqual({ description: 'Signed in' });
    expect(responses['401']).toEqual({
      description: 'Invalid or expired code',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ApiErrorResponse' },
          example: { statusCode: 401, message: 'Invalid or expired code', error: 'Unauthorized', code: 'UNAUTHORIZED' },
        },
      },
    });
    expect(responses['418']).toMatchObject({
      content: { 'application/json': { example: { message: "I'm a Teapot", error: "I'm a Teapot" } } },
    });
    expect(responses['409']).toEqual({ description: 'Already documented', content: { 'text/plain': {} } });
  });

  it('accepts a document without paths', () => {
    expect(attachErrorResponseSchema({})).toEqual({});
  });
});
