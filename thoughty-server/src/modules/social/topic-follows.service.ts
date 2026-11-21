import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TopicFollow } from '@/database/entities';
import type { FollowedTopicDto, TopicFollowStateDto } from './dto';

/**
 * Feed topics a reader follows: tags whose public entries join the Following tab. A topic is its tag
 * ignoring case; PostgreSQL lowers it, as the feed does when it matches entries' tags, so both agree.
 */
@Injectable()
export class TopicFollowsService {
  constructor(
    @InjectRepository(TopicFollow)
    private readonly topicFollowRepository: Repository<TopicFollow>,
  ) {}

  async list(userId: number): Promise<FollowedTopicDto[]> {
    const topics = await this.topicFollowRepository.find({
      where: { userId },
      order: { tag: 'ASC' },
    });
    return topics.map((topic) => ({
      tag: topic.tag,
      followedAt: new Date(topic.createdAt).toISOString(),
    }));
  }

  async follow(userId: number, tag: string): Promise<TopicFollowStateDto> {
    // Following a topic again keeps it as it was (and when it was first followed)
    const [row] = (await this.topicFollowRepository.query(
      `INSERT INTO topic_follows (user_id, tag) VALUES ($1, lower($2))
       ON CONFLICT (user_id, tag) DO UPDATE SET tag = EXCLUDED.tag
       RETURNING tag`,
      [userId, tag],
    )) as Array<{ tag: string }>;
    return { tag: row!.tag, following: true };
  }

  async unfollow(userId: number, tag: string): Promise<TopicFollowStateDto> {
    const [row] = (await this.topicFollowRepository.query(
      `WITH topic AS (SELECT lower($2::text) AS tag),
            removed AS (
              DELETE FROM topic_follows f USING topic WHERE f.user_id = $1 AND f.tag = topic.tag
            )
       SELECT tag FROM topic`,
      [userId, tag],
    )) as Array<{ tag: string }>;
    return { tag: row!.tag, following: false };
  }
}
