import type { DeepPartial, EntityManager } from 'typeorm';
import { Diary, Setting, User } from '@/database/entities';
import { getDefaultDiaryColor } from '@/common/utils';
import type { SignUpPreferences } from '../dto/sign-up-preferences.dto';

/** The private "Thoughts" diary every new account starts with. */
function defaultDiaryFor(userId: number): Partial<Diary> {
  return {
    userId,
    name: 'Thoughts',
    icon: '💭',
    color: getDefaultDiaryColor(0),
    isDefault: true,
    visibility: 'private',
  };
}

/** The settings rows for the preferences given at sign-up; one left out keeps the account default. */
function preferenceSettingsFor(userId: number, { language, theme }: SignUpPreferences): Partial<Setting>[] {
  const given: Array<[key: string, value: string | undefined]> = [['language', language], ['theme', theme]];
  return given.flatMap(([key, value]) => (value ? [{ userId, key, value }] : []));
}

/**
 * Creates an account, its default diary and the settings it starts with (the visitor's language and
 * theme, when given) through `manager`, which the caller runs in a transaction, so a unique violation
 * on the username or address leaves none of them behind.
 */
export async function saveNewAccount(
  manager: EntityManager,
  fields: DeepPartial<User>,
  preferences: SignUpPreferences = {},
): Promise<User> {
  const user = await manager.save(User, manager.create(User, fields));
  await manager.save(Diary, manager.create(Diary, defaultDiaryFor(user.id)));
  const settings = preferenceSettingsFor(user.id, preferences);
  if (settings.length > 0) {
    await manager.save(Setting, settings);
  }
  return user;
}
