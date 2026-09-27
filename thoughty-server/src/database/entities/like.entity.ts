import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Entry } from './entry.entity';
import { EntryComment } from './entry-comment.entity';
import { User } from './user.entity';

@Entity('entry_likes')
export class EntryLike {
  @PrimaryColumn({ name: 'entry_id', type: 'integer' })
  entryId: number;

  @PrimaryColumn({ name: 'user_id', type: 'integer' })
  userId: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => Entry, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entry_id' })
  entry: Entry;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}

@Entity('comment_likes')
export class CommentLike {
  @PrimaryColumn({ name: 'comment_id', type: 'integer' })
  commentId: number;

  @PrimaryColumn({ name: 'user_id', type: 'integer' })
  userId: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => EntryComment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comment_id' })
  comment: EntryComment;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
