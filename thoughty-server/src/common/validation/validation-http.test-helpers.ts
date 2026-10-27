import { CanActivate, ExecutionContext, INestApplication, Provider, Type } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ApiErrorCodeFilter } from '@/common/errors/api-error-code.filter';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { createGlobalValidationPipe } from './global-validation-pipe';

export const HTTP_SPEC_USER = { userId: 7, email: 'writer@example.com', username: 'writer' };

/** Signs every request in as HTTP_SPEC_USER, standing in for the JWT guard. */
const signedInGuard: CanActivate = {
  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getRequest().user = HTTP_SPEC_USER;
    return true;
  },
};

/**
 * A Nest app around real controllers with the API's own global ValidationPipe and error codes, so a
 * spec sees exactly what a query string or form field becomes before it reaches the service mocks.
 */
export async function createValidatedControllerApp(controllers: Type[], providers: Provider[]): Promise<INestApplication> {
  const module = await Test.createTestingModule({
    controllers,
    providers: [...providers, { provide: APP_FILTER, useClass: ApiErrorCodeFilter }],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue(signedInGuard)
    .compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(createGlobalValidationPipe());
  await app.init();
  return app;
}
