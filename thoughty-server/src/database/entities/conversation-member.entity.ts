import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity';
import { User } from './user.entity';

/** A writer in a conversation, and the newest message they have read in it (0 before any). */
@Entity('conversation_members')
@Index('idx_conversation_members_user', ['userId'])
export class ConversationMember {
  @PrimaryColumn({ name: 'conversation_id', type: 'integer' })
  conversationId: number;

  @PrimaryColumn({ name: 'user_id', type: 'integer' })
  userId: number;

  /** The id of the newest message the writer has seen; the others' messages after it are unread. */
  @Column({ name: 'last_read_message_id', type: 'integer', default: 0 })
  lastReadMessageId: number;

  @CreateDateColumn({ name: 'joined_at', type: 'timestamptz' })
  joinedAt: Date;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
