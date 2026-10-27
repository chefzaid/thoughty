import { BadRequestException, Type } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { GLOBAL_VALIDATION_PIPE_OPTIONS, createGlobalValidationPipe } from './global-validation-pipe';

/*
 * DTO specs validate through the API's own global ValidationPipe options, so they cannot accept or
 * refuse a value the running API treats differently (docs/development.md › Request validation).
 */

type InputSource = 'body' | 'query';

/** What a controller receives for `plain`, through the global pipe; a refused input rejects with its BadRequestException. */
export function parseLikeApi<T extends object>(dto: Type<T>, plain: unknown, source: InputSource = 'body'): Promise<T> {
  return createGlobalValidationPipe().transform(plain, { type: source, metatype: dto }) as Promise<T>;
}

function propertyPaths(error: ValidationError, parent = ''): string[] {
  const path = `${parent}${error.property}`;
  return error.children?.length ? error.children.flatMap((child) => propertyPaths(child, `${path}.`)) : [path];
}

/**
 * The properties the API refuses in `plain` (nested ones as `parent.child`), or `[]` when it takes
 * it. Built with the global pipe's own transform and validator options, and checked against the
 * pipe itself, so a spec fails if the two ever disagree.
 */
export async function invalidPropertiesLikeApi(dto: Type<object>, plain: object, source: InputSource = 'body'): Promise<string[]> {
  const { transform: _transform, transformOptions, ...validatorOptions } = GLOBAL_VALIDATION_PIPE_OPTIONS;
  const paths = (await validate(plainToInstance(dto, plain, transformOptions), validatorOptions)).flatMap((error) => propertyPaths(error));
  const pipeAccepts = await parseLikeApi(dto, plain, source).then(
    () => true,
    (error: unknown) => {
      if (error instanceof BadRequestException) return false;
      throw error;
    },
  );
  if (pipeAccepts !== (paths.length === 0)) {
    throw new Error(`The global pipe ${pipeAccepts ? 'accepts' : 'refuses'} ${JSON.stringify(plain)}, but its options found ${JSON.stringify(paths)}`);
  }
  return paths;
}
