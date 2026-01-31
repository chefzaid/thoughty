import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from '@/database/entities';

const DEFAULT_SETTINGS: Record<string, string> = {
  theme: 'dark',
  name: 'User',
  entriesPerPage: '10',
  defaultVisibility: 'private',
  language: 'en',
};

@Injectable()
export class ConfigService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
  ) {}

  async getConfig(userId: number): Promise<Record<string, string>> {
    const settings = await this.settingRepository.find({
      where: { userId },
    });

    const config = { ...DEFAULT_SETTINGS };
    for (const setting of settings) {
      config[setting.key] = setting.value;
    }

    return config;
  }

  async updateConfig(userId: number, newConfig: Record<string, string>): Promise<{ success: boolean }> {
    for (const [key, value] of Object.entries(newConfig)) {
      await this.settingRepository.upsert(
        {
          userId,
          key,
          value: String(value),
        },
        ['userId', 'key'],
      );
    }

    return { success: true };
  }
}
