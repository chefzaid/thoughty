import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { FeatureRequest, FeatureRequestVote, type FeatureRequestStatus } from '@/database/entities';
import type {
  CreateFeatureRequestDto,
  FeatureRequestDto,
  FeatureRequestVoteResponseDto,
} from './dto';

const MAX_BOARD_REQUESTS = 100;

interface FeatureRequestRow {
  id: number | string;
  title: string;
  details: string;
  status: FeatureRequestStatus;
  votes: number | string;
  createdAt: Date | string;
}

function toFeatureRequestDto(
  request: Pick<FeatureRequest, 'id' | 'title' | 'details' | 'status' | 'createdAt'>,
  votes: number,
): FeatureRequestDto {
  return {
    id: request.id,
    title: request.title,
    details: request.details,
    status: request.status,
    votes,
    createdAt: new Date(request.createdAt).toISOString(),
  };
}

@Injectable()
export class FeatureRequestsService {
  constructor(
    @InjectRepository(FeatureRequest)
    private readonly featureRequestRepository: Repository<FeatureRequest>,
    @InjectRepository(FeatureRequestVote)
    private readonly voteRepository: Repository<FeatureRequestVote>,
    private readonly dataSource: DataSource,
  ) {}

  async list(): Promise<FeatureRequestDto[]> {
    const rows = await this.featureRequestRepository
      .createQueryBuilder('request')
      .leftJoin(FeatureRequestVote, 'vote', 'vote.feature_request_id = request.id')
      .select('request.id', 'id')
      .addSelect('request.title', 'title')
      .addSelect('request.details', 'details')
      .addSelect('request.status', 'status')
      .addSelect('request.created_at', 'createdAt')
      .addSelect('COUNT(vote.id)', 'votes')
      .groupBy('request.id')
      .addGroupBy('request.title')
      .addGroupBy('request.details')
      .addGroupBy('request.status')
      .addGroupBy('request.created_at')
      .orderBy('COUNT(vote.id)', 'DESC')
      .addOrderBy('request.created_at', 'DESC')
      .take(MAX_BOARD_REQUESTS)
      .getRawMany<FeatureRequestRow>();

    return rows.map((row) =>
      toFeatureRequestDto(
        {
          id: Number(row.id),
          title: row.title,
          details: row.details,
          status: row.status,
          createdAt: new Date(row.createdAt),
        },
        Number(row.votes),
      ),
    );
  }

  async create(userId: number, dto: CreateFeatureRequestDto): Promise<FeatureRequestDto> {
    return this.dataSource.transaction(async (manager) => {
      const requestRepository = manager.getRepository(FeatureRequest);
      const voteRepository = manager.getRepository(FeatureRequestVote);
      const request = await requestRepository.save(
        requestRepository.create({
          userId,
          title: dto.title,
          details: dto.details,
          status: 'open',
        }),
      );
      await voteRepository.save(voteRepository.create({ featureRequestId: request.id, userId }));
      return toFeatureRequestDto(request, 1);
    });
  }

  async getVotedRequestIds(userId: number): Promise<number[]> {
    const votes = await this.voteRepository.find({
      where: { userId },
      select: { featureRequestId: true },
    });
    return votes.map((vote) => vote.featureRequestId);
  }

  async vote(userId: number, requestId: number): Promise<FeatureRequestVoteResponseDto> {
    const request = await this.featureRequestRepository.findOne({
      where: { id: requestId },
      select: { id: true },
    });
    if (!request) {
      throw new NotFoundException('Feature request not found');
    }

    await this.voteRepository
      .createQueryBuilder()
      .insert()
      .into(FeatureRequestVote)
      .values({ featureRequestId: requestId, userId })
      .orIgnore()
      .execute();
    const votes = await this.voteRepository.count({ where: { featureRequestId: requestId } });

    return { requestId, votes, voted: true };
  }
}
