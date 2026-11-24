import type { Repository } from 'typeorm';
import type { Setting } from '@/database/entities';

/**
 * The account's app language (its `language` setting) as stored, or undefined when the writer never
 * chose one. The emails about the account are written in it (`resolveEmailLanguage` reads anything but
 * `fr` as English).
 */
export async function findAccountLanguage(
  settingRepository: Repository<Setting>,
  userId: number,
): Promise<string | undefined> {
  const setting = await settingRepository.findOne({
    where: { userId, key: 'language' },
    select: { value: true },
  });
  return setting?.value;
}
