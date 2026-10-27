import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { RequestMethod } from '@nestjs/common';
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';

/** Where `@ApiResponse` keeps a handler's documented responses (`DECORATORS.API_RESPONSE` in @nestjs/swagger). */
const API_RESPONSE_METADATA = 'swagger/apiResponse';

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
          }))
          .filter(({ handler }) => Reflect.getMetadata(METHOD_METADATA, handler) !== undefined),
      ),
  );
}

describe('route documentation', () => {
  it('finds the route handlers', () => {
    expect(listHandlers().length).toBeGreaterThan(100);
  });

  // A POST answers 201 unless it says otherwise, so one documented as 200 needs `@HttpCode(HttpStatus.OK)`:
  // the generated web types read the documented status.
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
});
