import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { apiError } from '@/common/errors';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Diary } from '@/database/entities';
import { getDefaultDiaryColor, normalizeDiaryColor, sanitizeString } from '@/common/utils';
import { CreateDiaryDto, UpdateDiaryDto } from './dto';

type DiaryGoalFields = Pick<Diary, 'goalType' | 'goalTarget'>;

/** The validated goal fields to store, or undefined to keep the current goal. */
function goalFields(dto: CreateDiaryDto | UpdateDiaryDto): DiaryGoalFields | undefined {
  if (dto.goalType === undefined) return undefined;
  return dto.goalType === null
    ? { goalType: null, goalTarget: null }
    : { goalType: dto.goalType, goalTarget: dto.goalTarget ?? null };
}
import { DiaryEntryTransferService } from './diary-entry-transfer.service';

@Injectable()
export class DiariesService {
  constructor(
    @InjectRepository(Diary)
    private readonly diaryRepository: Repository<Diary>,
    private readonly diaryEntryTransferService: DiaryEntryTransferService,
  ) {}

  async findAll(userId: number): Promise<Diary[]> {
    return this.diaryRepository.find({
      where: { userId },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
  }

  async create(userId: number, dto: CreateDiaryDto): Promise<Diary> {
    const sanitizedName = sanitizeString(dto.name.trim()).substring(0, 100);
    const sanitizedIcon = sanitizeString(dto.icon || '📓').substring(0, 10);
    const visibility = ['public', 'private'].includes(dto.visibility || '')
      ? dto.visibility
      : 'private';
    const requestedColor = normalizeDiaryColor(dto.color);

    try {
      // Set position to the end
      const count = await this.diaryRepository.count({ where: { userId } });
      return await this.diaryRepository.save({
        userId,
        name: sanitizedName,
        icon: sanitizedIcon,
        color: requestedColor ?? getDefaultDiaryColor(count),
        visibility,
        isDefault: false,
        position: count,
        ...(goalFields(dto) ?? { goalType: null, goalTarget: null }),
      });
    } catch (error: unknown) {
      if ((error as { code?: string }).code === '23505') {
        throw apiError(ConflictException, 'DIARY_NAME_TAKEN');
      }
      throw error;
    }
  }

  async update(userId: number, id: number, dto: UpdateDiaryDto): Promise<Diary> {
    const diary = await this.diaryRepository.findOne({
      where: { id, userId },
    });

    if (!diary) {
      throw apiError(NotFoundException, 'DIARY_NOT_FOUND');
    }

    const sanitizedName = sanitizeString(dto.name.trim()).substring(0, 100);
    const sanitizedIcon = sanitizeString(dto.icon || '📓').substring(0, 10);
    const visibility = ['public', 'private'].includes(dto.visibility || '')
      ? dto.visibility
      : diary.visibility;
    const requestedColor = normalizeDiaryColor(dto.color);

    diary.name = sanitizedName;
    diary.icon = sanitizedIcon;
    diary.color = dto.color === undefined ? diary.color : requestedColor ?? diary.color;
    diary.visibility = visibility as 'public' | 'private';
    Object.assign(diary, goalFields(dto));

    try {
      return await this.diaryRepository.save(diary);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === '23505') {
        throw apiError(ConflictException, 'DIARY_NAME_TAKEN');
      }
      throw error;
    }
  }

  async delete(userId: number, id: number): Promise<{ success: boolean }> {
    const diary = await this.diaryRepository.findOne({
      where: { id, userId },
    });

    if (!diary) {
      throw apiError(NotFoundException, 'DIARY_NOT_FOUND');
    }

    if (diary.isDefault) {
      throw apiError(BadRequestException, 'DIARY_DEFAULT_NOT_DELETABLE');
    }

    // Get default diary to move entries to
    const defaultDiary = await this.diaryRepository.findOne({
      where: { userId, isDefault: true },
    });

    if (defaultDiary) {
      await this.diaryEntryTransferService.moveEntriesToDiary(userId, id, defaultDiary.id);
    }

    await this.diaryRepository.delete({ id, userId });

    return { success: true };
  }

  async setDefault(userId: number, id: number): Promise<Diary> {
    const diary = await this.diaryRepository.findOne({
      where: { id, userId },
    });

    if (!diary) {
      throw apiError(NotFoundException, 'DIARY_NOT_FOUND');
    }

    // Unset all other defaults
    await this.diaryRepository.update({ userId }, { isDefault: false });

    // Set new default
    diary.isDefault = true;
    return this.diaryRepository.save(diary);
  }

  async reorder(
    userId: number,
    orderedIds: number[],
  ): Promise<{ success: boolean }> {
    // Verify all diary IDs belong to the user
    const diaries = await this.diaryRepository.find({ where: { userId } });
    const userDiaryIds = new Set(diaries.map((d) => d.id));

    for (const id of orderedIds) {
      if (!userDiaryIds.has(id)) {
        throw apiError(BadRequestException, 'DIARY_NOT_FOUND', `Diary ${id} not found`);
      }
    }

    // Update positions
    const updates = orderedIds.map((id, index) =>
      this.diaryRepository.update({ id, userId }, { position: index }),
    );
    await Promise.all(updates);

    return { success: true };
  }
}
