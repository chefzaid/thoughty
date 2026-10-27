import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { apiError } from '@/common/errors';
import { InjectRepository } from '@nestjs/typeorm';
import { Raw, Repository } from 'typeorm';
import { Diary, DIARY_NAME_UNIQUE_INDEX } from '@/database/entities';
import { getDefaultDiaryColor, normalizeDiaryColor, sanitizeString } from '@/common/utils';
import { CreateDiaryDto, UpdateDiaryDto } from './dto';
import { DiaryEntryTransferService } from './diary-entry-transfer.service';

type DiaryGoalFields = Pick<Diary, 'goalType' | 'goalTarget'>;

/** The validated goal fields to store, or undefined to keep the current goal. */
function goalFields(dto: CreateDiaryDto | UpdateDiaryDto): DiaryGoalFields | undefined {
  if (dto.goalType === undefined) return undefined;
  return dto.goalType === null
    ? { goalType: null, goalTarget: null }
    : { goalType: dto.goalType, goalTarget: dto.goalTarget ?? null };
}

/**
 * Saves a diary, answering 409 `DIARY_NAME_TAKEN` when the writer has another diary of that name. The
 * unique index decides, so two requests racing for one name cannot both win.
 */
async function withUniqueName(save: () => Promise<Diary>): Promise<Diary> {
  try {
    return await save();
  } catch (error: unknown) {
    const { code, constraint } = error as { code?: string; constraint?: string };
    if (code === '23505' && constraint === DIARY_NAME_UNIQUE_INDEX) {
      throw apiError(ConflictException, 'DIARY_NAME_TAKEN');
    }
    throw error;
  }
}

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

    // Set position to the end
    const count = await this.diaryRepository.count({ where: { userId } });
    return withUniqueName(() =>
      this.diaryRepository.save({
        userId,
        name: sanitizedName,
        icon: sanitizedIcon,
        color: requestedColor ?? getDefaultDiaryColor(count),
        visibility,
        isDefault: false,
        position: count,
        ...(goalFields(dto) ?? { goalType: null, goalTarget: null }),
      }),
    );
  }

  /** The writer's diary of that name, ignoring case and surrounding spaces as the unique index does. */
  async findByName(userId: number, name: string): Promise<Diary | null> {
    return this.diaryRepository.findOne({
      where: { userId, name: Raw((column) => `LOWER(BTRIM(${column})) = LOWER(BTRIM(:name))`, { name }) },
    });
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

    return withUniqueName(() => this.diaryRepository.save(diary));
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
