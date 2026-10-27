import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { apiError } from '@/common/errors';
import { LifeEra } from '@/database/entities';
import {
  CreateLifeEraDto,
  LIFE_ERA_LIMIT,
  LifeEraListResponseDto,
  LifeEraResponseDto,
  UpdateLifeEraDto,
} from './dto';

/** Namespace of the advisory lock that serializes one writer's new eras, so the limit holds under concurrent requests. */
const LIFE_ERA_LOCK_NAMESPACE = 'life_eras';
const UNIQUE_VIOLATION = '23505';

/**
 * The writer's life eras. Entries belong to an era by their date, so changing or deleting one changes
 * what the journal lists for it: the cached entry lists are dropped, and saved searches filtered by a
 * deleted era widen to every date, as they do when their diary is deleted.
 */
@Injectable()
export class LifeErasService {
  constructor(
    @InjectRepository(LifeEra)
    private readonly lifeEraRepository: Repository<LifeEra>,
  ) {}

  async list(userId: number): Promise<LifeEraListResponseDto> {
    return { lifeEras: (await this.findAll(userId)).map(toLifeEraResponse), limit: LIFE_ERA_LIMIT };
  }

  /** Every era of the writer, by start date, ongoing eras after those that end the same day, then by name. */
  async findAll(userId: number): Promise<LifeEra[]> {
    return this.lifeEraRepository
      .createQueryBuilder('era')
      .where('era.user_id = :userId', { userId })
      .orderBy('era.start_date', 'ASC')
      .addOrderBy('era.end_date', 'ASC', 'NULLS LAST')
      .addOrderBy('LOWER(era.name)', 'ASC')
      .addOrderBy('era.id', 'ASC')
      .getMany();
  }

  /** One of the writer's eras, refused when it is not theirs. */
  async findOwn(userId: number, id: number): Promise<LifeEra> {
    const era = await this.lifeEraRepository.findOne({ where: { id, userId } });
    if (!era) {
      throw apiError(NotFoundException, 'LIFE_ERA_NOT_FOUND');
    }
    return era;
  }

  async create(userId: number, dto: CreateLifeEraDto): Promise<LifeEraResponseDto> {
    const endDate = dto.endDate ?? null;
    assertDateRange(dto.startDate, endDate);
    const era = await this.withNameCheck(() => this.lifeEraRepository.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1), $2)', [LIFE_ERA_LOCK_NAMESPACE, userId]);
      const repository = manager.getRepository(LifeEra);
      if (await repository.count({ where: { userId } }) >= LIFE_ERA_LIMIT) {
        throw apiError(BadRequestException, 'LIFE_ERA_LIMIT_REACHED', `Life era limit reached (${LIFE_ERA_LIMIT})`);
      }
      return repository.save(repository.create({
        userId,
        name: dto.name,
        startDate: dto.startDate,
        endDate,
        color: dto.color ?? null,
        emoji: dto.emoji ?? null,
        note: dto.note ?? null,
      }));
    }));
    return toLifeEraResponse(era);
  }

  async update(userId: number, id: number, dto: UpdateLifeEraDto): Promise<LifeEraResponseDto> {
    const era = await this.findOwn(userId, id);
    if (dto.name !== undefined) era.name = dto.name;
    if (dto.startDate !== undefined) era.startDate = dto.startDate;
    if (dto.endDate !== undefined) era.endDate = dto.endDate;
    if (dto.color !== undefined) era.color = dto.color;
    if (dto.emoji !== undefined) era.emoji = dto.emoji;
    if (dto.note !== undefined) era.note = dto.note;
    assertDateRange(era.startDate, era.endDate);

    const saved = await this.withNameCheck(() => this.lifeEraRepository.save(era));
    return toLifeEraResponse(saved);
  }

  async delete(userId: number, id: number): Promise<{ success: boolean }> {
    await this.lifeEraRepository.manager.transaction(async (manager) => {
      const result = await manager.getRepository(LifeEra).delete({ id, userId });
      if (!result.affected) {
        throw apiError(NotFoundException, 'LIFE_ERA_NOT_FOUND');
      }
      await manager.query(
        `UPDATE saved_searches SET filters = jsonb_set(filters, '{eraId}', 'null'::jsonb), updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $1 AND filters->>'eraId' = $2`,
        [userId, String(id)],
      );
    });
    return { success: true };
  }

  /** Runs a write and turns a clash with another era's name (in any case) into a coded conflict. */
  private async withNameCheck<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error: unknown) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw apiError(ConflictException, 'LIFE_ERA_NAME_TAKEN');
      }
      throw error;
    }
  }
}

function assertDateRange(startDate: string, endDate: string | null): void {
  if (endDate !== null && endDate < startDate) {
    throw apiError(BadRequestException, 'LIFE_ERA_DATES_INVALID');
  }
}

export function toLifeEraResponse(era: LifeEra): LifeEraResponseDto {
  return {
    id: era.id,
    name: era.name,
    startDate: era.startDate,
    endDate: era.endDate,
    color: era.color,
    emoji: era.emoji,
    note: era.note,
    createdAt: era.createdAt,
    updatedAt: era.updatedAt,
  };
}
