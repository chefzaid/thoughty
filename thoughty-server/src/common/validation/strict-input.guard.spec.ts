import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { ApiPropertyOptional, DECORATORS } from '@nestjs/swagger';
import { TransformationType, Type } from 'class-transformer';
import type { MetadataStorage } from 'class-transformer/types/MetadataStorage';
import { IsInt, IsOptional, getMetadataStorage } from 'class-validator';
import type { ValidationMetadata } from 'class-validator/types/metadata/ValidationMetadata';
import { StrictBoolean, StrictInt, toStrictBoolean, toStrictInt, toStrictIntEach } from './strict-input.decorators';

/*
 * Guards the rule in docs/development.md (Request validation): the global pipe converts nothing on
 * its own, so
 *  - every boolean DTO property reads its raw value through @StrictBoolean(),
 *  - every number DTO property (query, form or JSON body) reads it through @StrictInt(), and
 *  - no property converts a value with @Type(() => Number | String | Boolean), which would turn
 *    `''` into `0` or `{}` into '[object Object]'.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { defaultMetadataStorage } = require('class-transformer/cjs/storage') as { defaultMetadataStorage: MetadataStorage };

type Constructor = abstract new (...args: never[]) => unknown;

const SRC = path.resolve(__dirname, '../..');

function sourceFiles(suffix: string, dir = SRC): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(suffix, full);
    return entry.name.endsWith(suffix) ? [full] : [];
  });
}

function exportedClasses(file: string): Constructor[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return Object.values(require(file) as Record<string, unknown>).filter(
    (value): value is Constructor => typeof value === 'function' && /^class\s/.test(Function.prototype.toString.call(value)),
  );
}

function validationsOf(cls: Constructor): ValidationMetadata[] {
  return getMetadataStorage().getTargetValidationMetadatas(cls as never, '', true, false);
}

function hasTransform(cls: Constructor, property: string, transformFns: readonly unknown[]): boolean {
  return defaultMetadataStorage
    .findTransformMetadatas(cls as never, property, TransformationType.PLAIN_TO_CLASS)
    .some((entry) => transformFns.includes(entry.transformFn));
}

/** A number by its TypeScript type, its documented type (`number | null` is `Object` at runtime) or its validator. */
function isNumberProperty(cls: Constructor, property: string, validations: ValidationMetadata[]): boolean {
  if (Reflect.getMetadata('design:type', cls.prototype as object, property) === Number) return true;
  const documented = (Reflect.getMetadata(DECORATORS.API_MODEL_PROPERTIES, cls.prototype as object, property) as { type?: unknown } | undefined)?.type;
  if (documented === Number || (Array.isArray(documented) && documented[0] === Number)) return true;
  return validations.some((entry) => entry.propertyName === property && (entry.name === 'isInt' || entry.name === 'isNumber'));
}

function convertsThroughType(cls: Constructor, property: string): boolean {
  const target = defaultMetadataStorage.findTypeMetadata(cls as never, property)?.typeFunction();
  return target === Number || target === String || target === Boolean;
}

/** The `Class.property` names that break the rule. */
export function strictInputViolations(classes: Iterable<Constructor>): string[] {
  const violations: string[] = [];
  for (const cls of classes) {
    const validations = validationsOf(cls);
    for (const property of new Set(validations.map((entry) => entry.propertyName))) {
      const type = Reflect.getMetadata('design:type', cls.prototype as object, property);
      if (type === Boolean && !hasTransform(cls, property, [toStrictBoolean])) {
        violations.push(`${cls.name}.${property} (boolean without @StrictBoolean())`);
      }
      if (isNumberProperty(cls, property, validations) && !hasTransform(cls, property, [toStrictInt, toStrictIntEach])) {
        violations.push(`${cls.name}.${property} (number without @StrictInt())`);
      }
      if (convertsThroughType(cls, property)) {
        violations.push(`${cls.name}.${property} (converted by @Type())`);
      }
    }
  }
  return violations;
}

/** The classes controllers read from query strings and bodies, wherever they are declared. */
function controllerInputClasses(): Set<Constructor> {
  const classes = new Set<Constructor>();
  for (const controller of sourceFiles('.controller.ts').flatMap(exportedClasses)) {
    const prototype = controller.prototype as Record<string, unknown>;
    for (const method of Object.getOwnPropertyNames(prototype)) {
      if (method === 'constructor' || typeof prototype[method] !== 'function') continue;
      const args: Record<string, { index: number }> = Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, method) ?? {};
      const paramTypes: Constructor[] = Reflect.getMetadata('design:paramtypes', prototype, method) ?? [];
      for (const [key, { index }] of Object.entries(args)) {
        const kind = Number(key.split(':')[0]);
        const paramType = paramTypes[index];
        if ((kind === RouteParamtypes.QUERY || kind === RouteParamtypes.BODY) && typeof paramType === 'function') classes.add(paramType);
      }
    }
  }
  return classes;
}

describe('strict boolean and number inputs', () => {
  const dtoClasses = new Set(sourceFiles('.dto.ts').flatMap(exportedClasses));
  const inputClasses = controllerInputClasses();

  it('finds the DTOs and the classes controllers read from queries, forms and JSON bodies', () => {
    expect(dtoClasses.size).toBeGreaterThan(100);
    expect([...inputClasses].map((cls) => cls.name)).toEqual(
      expect.arrayContaining(['BookQueryDto', 'GetEntriesQueryDto', 'LinkAttachmentDto', 'CreateEntryDto', 'BulkOperationDto', 'CloudUploadDto', 'CreateSavedSearchDto']),
    );
  });

  it('reads every boolean and every number DTO property through the shared decorators', () => {
    expect(strictInputViolations(new Set([...dtoClasses, ...inputClasses]))).toEqual([]);
  });

  it('reports a boolean or a number declared the old way', () => {
    class LegacyDto {
      @IsOptional()
      flag?: boolean;

      @IsOptional()
      count?: number;

      @ApiPropertyOptional({ type: Number, nullable: true })
      @IsOptional()
      @IsInt()
      nullableCount?: number | null;

      @IsOptional()
      @IsInt({ each: true })
      @Type(() => Number)
      ids?: number[];

      @IsOptional()
      @StrictBoolean()
      fixedFlag?: boolean;

      @IsOptional()
      @StrictInt()
      fixedCount?: number;

      @IsOptional()
      @StrictInt({ each: true })
      fixedIds?: number[];
    }

    expect(strictInputViolations([LegacyDto])).toEqual([
      'LegacyDto.flag (boolean without @StrictBoolean())',
      'LegacyDto.count (number without @StrictInt())',
      'LegacyDto.nullableCount (number without @StrictInt())',
      'LegacyDto.ids (number without @StrictInt())',
      'LegacyDto.ids (converted by @Type())',
    ]);
  });
});
