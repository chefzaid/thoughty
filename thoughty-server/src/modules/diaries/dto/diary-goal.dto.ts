import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';
import type { DiaryGoalType } from '@/database/entities';

export const DIARY_GOAL_TYPES: readonly DiaryGoalType[] = ['entries_per_week', 'words_per_day'];

/** The bounds of each goal type; the `chk_diaries_goal` constraint holds the same values. */
export const DIARY_GOAL_LIMITS: Readonly<Record<DiaryGoalType, { min: number; max: number }>> = {
  entries_per_week: { min: 1, max: 50 },
  words_per_day: { min: 10, max: 10_000 },
};

export function isDiaryGoalType(value: unknown): value is DiaryGoalType {
  return DIARY_GOAL_TYPES.includes(value as DiaryGoalType);
}

/**
 * A goal target is a whole number within its type's bounds, sent with a goal type; with a null
 * goal type it must be left out or null too.
 */
export function IsDiaryGoalTarget(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyName) => {
    registerDecorator({
      name: 'isDiaryGoalTarget',
      target: target.constructor,
      propertyName: propertyName as string,
      options: {
        message: 'goalTarget must be a whole number within the bounds of goalType (entries_per_week: 1-50, words_per_day: 10-10000)',
        ...options,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const { goalType } = args.object as { goalType?: unknown };
          if (goalType === undefined || goalType === null) return value === undefined || value === null;
          if (!isDiaryGoalType(goalType) || !Number.isInteger(value)) return false;
          const { min, max } = DIARY_GOAL_LIMITS[goalType];
          return (value as number) >= min && (value as number) <= max;
        },
      },
    });
  };
}
