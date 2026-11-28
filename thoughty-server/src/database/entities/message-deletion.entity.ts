import { CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Message } from './message.entity';
import { User } from './user.entity';

/** A message one writer deleted for themselves; the other writers in the conversation still have it. */
@Entity('message_deletions')
@Index('idx_message_deletions_user', ['userId'])
export class MessageDeletion {
  @PrimaryColumn({ name: 'message_id', type: 'integer' })
  messageId: number;

  @PrimaryColumn({ name: 'user_id', type: 'integer' })
  userId: number;

  @CreateDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;

  @ManyToOne(() => Message, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message: Message;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
