import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Diary, Entry } from '@/database/entities';
import { sanitizeString } from '@/common/utils';
import { CreateDiaryDto, UpdateDiaryDto } from './dto';

@Injectable()
export class DiariesService {
  constructor(
    @InjectRepository(Diary)
    private readonly diaryRepository: Repository<Diary>,
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
  ) {}

  async findAll(userId: number): Promise<Diary[]> {
    return this.diaryRepository.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
  }

  async create(userId: number, dto: CreateDiaryDto): Promise<Diary> {
    const sanitizedName = sanitizeString(dto.name.trim()).substring(0, 100);
    const sanitizedIcon = sanitizeString(dto.icon || '📓').substring(0, 10);
    const visibility = ['public', 'private'].includes(dto.visibility || '')
      ? dto.visibility
      : 'private';

    try {
      return await this.diaryRepository.save({
        userId,
        name: sanitizedName,
        icon: sanitizedIcon,
        visibility,
        isDefault: false,
      });
    } catch (error: unknown) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('A diary with this name already exists');
      }
      throw error;
    }
  }

  async update(userId: number, id: number, dto: UpdateDiaryDto): Promise<Diary> {
    const diary = await this.diaryRepository.findOne({
      where: { id, userId },
    });

    if (!diary) {
      throw new NotFoundException('Diary not found');
    }

    const sanitizedName = sanitizeString(dto.name.trim()).substring(0, 100);
    const sanitizedIcon = sanitizeString(dto.icon || '📓').substring(0, 10);
    const visibility = ['public', 'private'].includes(dto.visibility || '')
      ? dto.visibility
      : diary.visibility;

    diary.name = sanitizedName;
    diary.icon = sanitizedIcon;
    diary.visibility = visibility as 'public' | 'private';

    try {
      return await this.diaryRepository.save(diary);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('A diary with this name already exists');
      }
      throw error;
    }
  }

  async delete(userId: number, id: number): Promise<{ success: boolean }> {
    const diary = await this.diaryRepository.findOne({
      where: { id, userId },
    });

    if (!diary) {
      throw new NotFoundException('Diary not found');
    }

    if (diary.isDefault) {
      throw new BadRequestException('Cannot delete the default diary');
    }

    // Get default diary to move entries to
    const defaultDiary = await this.diaryRepository.findOne({
      where: { userId, isDefault: true },
    });

    if (defaultDiary) {
      // Move entries to default diary
      await this.entryRepository.update({ diaryId: id, userId }, { diaryId: defaultDiary.id });
    }

    await this.diaryRepository.delete({ id, userId });

    return { success: true };
  }

  async setDefault(userId: number, id: number): Promise<Diary> {
    const diary = await this.diaryRepository.findOne({
      where: { id, userId },
    });

    if (!diary) {
      throw new NotFoundException('Diary not found');
    }

    // Unset all other defaults
    await this.diaryRepository.update({ userId }, { isDefault: false });

    // Set new default
    diary.isDefault = true;
    return this.diaryRepository.save(diary);
  }
}
