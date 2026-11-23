import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';

type Handler = (...args: unknown[]) => unknown;

export interface RouteHandler {
  /** `Controller.method`. */
  name: string;
  handler: Handler;
  controller: object;
}

function listControllerFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const path = join(dir, item.name);
    if (item.isDirectory()) return listControllerFiles(path);
    return item.name.endsWith('.controller.ts') ? [path] : [];
  });
}

/** Each route handler of the API's controllers. */
export function listHandlers(): RouteHandler[] {
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

/** The handler's operation as the OpenAPI document names it, such as `POST /api/entries/{entryId}/comments`. */
export function operationOf({ handler, controller }: RouteHandler): string {
  const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod];
  const segments = [
    'api',
    Reflect.getMetadata(PATH_METADATA, controller) as string,
    Reflect.getMetadata(PATH_METADATA, handler) as string,
  ];
  const path = segments
    .join('/')
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/^:(\w+)$/, '{$1}'))
    .join('/');
  return `${method} /${path}`;
}
