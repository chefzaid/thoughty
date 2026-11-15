import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { apiError } from '@/common/errors';
import { ComposerDraft } from '@/database/entities';
import { ComposerDraftEnvelopeDto, ComposerDraftResponseDto, SaveComposerDraftDto } from './dto';

/** The stored draft's columns, named as the response names them. */
const RETURNED_COLUMNS = `content AS text, title, tags, format, mood, feelings, revision, updated_at AS "updatedAt"`;

const conflict = () => apiError(ConflictException, 'COMPOSER_DRAFT_CONFLICT');

/** The rows a statement returned: TypeORM answers an UPDATE on PostgreSQL with `[rows, affected]`, an INSERT with the rows. */
const returnedRows = <T>(result: T[] | [T[], number]): T[] =>
  (Array.isArray(result[0]) ? result[0] : result) as T[];

/**
 * The writer's composer draft. Every write names the revision it was made on, and a write made on any
 * other is refused, in one statement each so two devices saving at once cannot both win.
 */
@Injectable()
export class ComposerDraftsService {
  constructor(
    @InjectRepository(ComposerDraft)
    private readonly draftRepository: Repository<ComposerDraft>,
  ) {}

  async get(userId: number): Promise<ComposerDraftEnvelopeDto> {
    const draft = await this.draftRepository.findOne({ where: { userId } });
    return { draft: draft ? this.toResponse(draft) : null };
  }

  /** Saves the draft on top of `baseRevision`: creates it when there is none, else moves it one revision on. */
  async save(userId: number, dto: SaveComposerDraftDto): Promise<ComposerDraftResponseDto> {
    const fields = [dto.text, dto.title || null, dto.tags, dto.format, dto.mood, dto.feelings];
    const result: ComposerDraftResponseDto[] | [ComposerDraftResponseDto[], number] = dto.baseRevision === null
      ? await this.draftRepository.query(
          `INSERT INTO composer_drafts (user_id, content, title, tags, format, mood, feelings)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (user_id) DO NOTHING
           RETURNING ${RETURNED_COLUMNS}`,
          [userId, ...fields],
        )
      : await this.draftRepository.query(
          `UPDATE composer_drafts
              SET content = $2, title = $3, tags = $4, format = $5, mood = $6, feelings = $7,
                  revision = revision + 1, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1 AND revision = $8
           RETURNING ${RETURNED_COLUMNS}`,
          [userId, ...fields, dto.baseRevision],
        );
    const [saved] = returnedRows(result);
    if (!saved) {
      throw conflict();
    }
    return saved;
  }

  /** Discards the draft, only while it is at `revision` when one is given; no draft is already discarded. */
  async discard(userId: number, revision?: number): Promise<{ success: boolean }> {
    const result = await this.draftRepository.delete(revision === undefined ? { userId } : { userId, revision });
    if (!result.affected && revision !== undefined && (await this.draftRepository.exists({ where: { userId } }))) {
      throw conflict();
    }
    return { success: true };
  }

  private toResponse(draft: ComposerDraft): ComposerDraftResponseDto {
    return {
      text: draft.content,
      title: draft.title,
      tags: draft.tags,
      format: draft.format,
      mood: draft.mood,
      feelings: draft.feelings,
      revision: draft.revision,
      updatedAt: draft.updatedAt,
    };
  }
}
