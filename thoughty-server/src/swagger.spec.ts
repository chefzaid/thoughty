import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createSwaggerConfig, createSwaggerDocument } from './swagger';
import { ApiErrorResponse } from './common/errors/api-error-response.dto';

jest.mock('@nestjs/swagger', () => {
  const actual = jest.requireActual('@nestjs/swagger');
  return {
    ...actual,
    SwaggerModule: {
      createDocument: jest.fn(),
    },
  };
});

describe('swagger helpers', () => {
  it('creates the expected Swagger document configuration', () => {
    process.env.PORT = '4567';

    const config = createSwaggerConfig();
    const document = new DocumentBuilder()
      .setTitle('Thoughty Journal API')
      .setDescription('API for Managing Journal Entries')
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT access token',
        },
        'bearer',
      )
      .addCookieAuth(
        'thoughty_refresh_token',
        {
          type: 'apiKey',
          in: 'cookie',
          description: 'httpOnly refresh token cookie (path /api/auth) set when a session starts',
        },
        'thoughty_refresh_token',
      )
      .addServer('http://localhost:4567')
      .build();

    expect(config).toEqual(document);
  });

  it('creates a Swagger document for the provided app', () => {
    const app = { getHttpServer: jest.fn() };
    const expected = { openapi: '3.0.0' };
    jest.mocked(SwaggerModule.createDocument).mockReturnValue(expected as never);

    const result = createSwaggerDocument(app as never);

    expect(SwaggerModule.createDocument).toHaveBeenCalledWith(app, expect.any(Object), { extraModels: [ApiErrorResponse] });
    expect(result).toBe(expected);
  });
});
