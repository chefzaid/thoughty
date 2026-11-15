import type { DeepPartial, EntityManager } from 'typeorm';
import { Diary, User } from '@/database/entities';
import { getDefaultDiaryColor } from '@/common/utils';

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

/**
 * Creates an account and its default diary through `manager`, which the caller runs in a
 * transaction, so a unique violation on the username or address leaves neither behind.
 */
export async function saveNewAccount(manager: EntityManager, fields: DeepPartial<User>): Promise<User> {
  const user = await manager.save(User, manager.create(User, fields));
  await manager.save(Diary, manager.create(Diary, defaultDiaryFor(user.id)));
  return user;
}
