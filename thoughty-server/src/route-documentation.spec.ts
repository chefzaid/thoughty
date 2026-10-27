import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { RequestMethod } from '@nestjs/common';
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { IS_PUBLIC_KEY } from './common/decorators/public.decorator';

/** Where `@ApiResponse` and `@ApiBearerAuth` keep their metadata (`DECORATORS` in @nestjs/swagger). */
const API_RESPONSE_METADATA = 'swagger/apiResponse';
const API_SECURITY_METADATA = 'swagger/apiSecurity';

function listControllerFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const path = join(dir, item.name);
    if (item.isDirectory()) return listControllerFiles(path);
    return item.name.endsWith('.controller.ts') ? [path] : [];
  });
}

type Handler = (...args: unknown[]) => unknown;

interface RouteHandler {
  name: string;
  handler: Handler;
  controller: object;
}

/** Each route handler of the API's controllers, as `Controller.method`. */
function listHandlers(): RouteHandler[] {
  return listControllerFiles(__dirname).flatMap((file) =>
    Object.values(jest.requireActual<Record<string, unknown>>(file))
      .filter(
        (value): value is { name: string; prototype: Record<string, Handler> } =>
          typeof value === 'function' && Reflect.getMetadata(PATH_METADATA, value) !== undefined,
      )
      .flatMap((controller) =>
        Object.getOwnPropertyNames(controller.prototype)
          .map((method) => ({
            name: `${controller.name}.${method}`,
            handler: controller.prototype[method]!,
            controller,
          }))
          .filter(({ handler }) => Reflect.getMetadata(METHOD_METADATA, handler) !== undefined),
      ),
  );
}

/** Whether the global JWT guard lets a handler through without a token (`@Public()` on it or its controller). */
function isPublic({ handler, controller }: RouteHandler): boolean {
  return Boolean(
    Reflect.getMetadata(IS_PUBLIC_KEY, handler) ?? Reflect.getMetadata(IS_PUBLIC_KEY, controller),
  );
}

/** Whether the OpenAPI document says the handler needs the bearer access token. */
function documentsBearer({ handler, controller }: RouteHandler): boolean {
  const security = [
    ...((Reflect.getMetadata(API_SECURITY_METADATA, controller) as object[] | undefined) ?? []),
    ...((Reflect.getMetadata(API_SECURITY_METADATA, handler) as object[] | undefined) ?? []),
  ];
  return security.some((requirement) => 'bearer' in requirement);
}

describe('route documentation', () => {
  it('finds the route handlers', () => {
    expect(listHandlers().length).toBeGreaterThan(100);
  });

  // A POST answers 201 unless it says otherwise, so one documented as 200 needs `@HttpCode(HttpStatus.OK)`:
  // the generated web types and the contract specs read the documented status.
  it('answers every route with a success status its OpenAPI responses document', () => {
    const mismatches = listHandlers().flatMap(({ name, handler }) => {
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod;
      const status =
        (Reflect.getMetadata(HTTP_CODE_METADATA, handler) as number | undefined) ??
        (method === RequestMethod.POST ? 201 : 200);
      const documented = Object.keys(
        (Reflect.getMetadata(API_RESPONSE_METADATA, handler) as
          | Record<string, unknown>
          | undefined) ?? {},
      ).map(Number);
      const successes = documented.filter((code) => code >= 200 && code < 300);
      return successes.length === 0 || successes.includes(status)
        ? []
        : [`${name} answers ${status} but documents ${successes.join(', ')}`];
    });
    expect(mismatches).toEqual([]);
  });

  // Swagger UI and the contract's guard check (test/api-contract/guards.e2e-spec.ts) read the security requirement
  it('documents the bearer token on exactly the routes the global guard protects', () => {
    const mismatches = listHandlers()
      .filter((route) => isPublic(route) === documentsBearer(route))
      .map(
        (route) =>
          `${route.name} is ${isPublic(route) ? 'public but documents' : 'protected but does not document'} the bearer token`,
      );
    expect(mismatches).toEqual([]);
  });
});
