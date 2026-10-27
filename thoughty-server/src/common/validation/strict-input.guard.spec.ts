import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { DECORATORS } from '@nestjs/swagger';
import { TransformationType } from 'class-transformer';
import type { MetadataStorage } from 'class-transformer/types/MetadataStorage';
import { IsOptional, getMetadataStorage } from 'class-validator';
import { StrictBoolean, StrictInt, toStrictBoolean, toStrictInt } from './strict-input.decorators';

/*
 * Guards the rule in docs/development.md (Request validation): under the global pipe's implicit
 * conversion, `Boolean('false')` is true and `Number('')` is 0, so
 *  - every boolean DTO property reads its raw value through @StrictBoolean(), and
 *  - every number in a query string or multipart form reads its raw value through @StrictInt().
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

function validatedProperties(cls: Constructor): string[] {
  const metadata = getMetadataStorage().getTargetValidationMetadatas(cls as never, '', true, false);
  return [...new Set(metadata.map((entry) => entry.propertyName))];
}

function hasTransform(cls: Constructor, property: string, transformFn: unknown): boolean {
  return defaultMetadataStorage
    .findTransformMetadatas(cls as never, property, TransformationType.PLAIN_TO_CLASS)
    .some((entry) => entry.transformFn === transformFn);
}

/** The `Class.property` names that break the rule; text-borne classes also need @StrictInt() on numbers. */
export function strictInputViolations(classes: Iterable<Constructor>, textBorne: ReadonlySet<Constructor>): string[] {
  const violations: string[] = [];
  for (const cls of classes) {
    for (const property of validatedProperties(cls)) {
      const type = Reflect.getMetadata('design:type', cls.prototype as object, property);
      if (type === Boolean && !hasTransform(cls, property, toStrictBoolean)) {
        violations.push(`${cls.name}.${property} (boolean without @StrictBoolean())`);
      }
      if (type === Number && textBorne.has(cls) && !hasTransform(cls, property, toStrictInt)) {
        violations.push(`${cls.name}.${property} (query/form number without @StrictInt())`);
      }
    }
  }
  return violations;
}

/** The DTO classes controllers read from query strings or multipart form fields. */
function textBorneClasses(): Set<Constructor> {
  const classes = new Set<Constructor>();
  for (const controller of sourceFiles('.controller.ts').flatMap(exportedClasses)) {
    const prototype = controller.prototype as Record<string, unknown>;
    for (const method of Object.getOwnPropertyNames(prototype)) {
      const handler = prototype[method];
      if (method === 'constructor' || typeof handler !== 'function') continue;
      const args: Record<string, { index: number }> = Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, method) ?? {};
      const paramTypes: Constructor[] = Reflect.getMetadata('design:paramtypes', prototype, method) ?? [];
      const multipart = ((Reflect.getMetadata(DECORATORS.API_CONSUMES, handler) as string[] | undefined) ?? [])
        .includes('multipart/form-data');
      for (const [key, { index }] of Object.entries(args)) {
        const kind = Number(key.split(':')[0]);
        if (kind === RouteParamtypes.QUERY || (multipart && kind === RouteParamtypes.BODY)) classes.add(paramTypes[index]);
      }
    }
  }
  return classes;
}

describe('strict boolean and number inputs', () => {
  const dtoClasses = new Set(sourceFiles('.dto.ts').flatMap(exportedClasses));
  const textBorne = textBorneClasses();

  it('finds the DTOs and the query and form classes it checks', () => {
    expect(dtoClasses.size).toBeGreaterThan(100);
    const names = [...textBorne].map((cls) => cls.name);
    expect(names).toEqual(
      expect.arrayContaining(['BookQueryDto', 'BookUploadQueryDto', 'GetEntriesQueryDto', 'GetEntryCalendarQueryDto', 'ExportQueryDto', 'LinkAttachmentDto', 'ImportAttachmentsDto']),
    );
    expect(names).not.toContain('CreateEntryDto');
  });

  it('reads every boolean DTO property and every query or form number through the shared decorators', () => {
    expect(strictInputViolations(new Set([...dtoClasses, ...textBorne]), textBorne)).toEqual([]);
  });

  it('reports a boolean or a query number declared the old way', () => {
    class LegacyQueryDto {
      @IsOptional()
      flag?: boolean;

      @IsOptional()
      count?: number;

      @IsOptional()
      @StrictBoolean()
      fixedFlag?: boolean;

      @IsOptional()
      @StrictInt()
      fixedCount?: number;
    }
    class LegacyBodyDto {
      @IsOptional()
      count?: number;
    }

    expect(strictInputViolations([LegacyQueryDto, LegacyBodyDto], new Set([LegacyQueryDto]))).toEqual([
      'LegacyQueryDto.flag (boolean without @StrictBoolean())',
      'LegacyQueryDto.count (query/form number without @StrictInt())',
    ]);
  });
});
