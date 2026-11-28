import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity';
import { User } from './user.entity';

/** How long a message may be, in characters. */
export const MESSAGE_MAX_LENGTH = 2000;

/** A message in a conversation, kept as plain text. */
@Entity('messages')
@Index('idx_messages_conversation', ['conversationId', 'id'])
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'conversation_id', type: 'integer' })
  conversationId: number;

  @Column({ name: 'sender_id', type: 'integer' })
  senderId: number;

  @Column({ type: 'varchar', length: MESSAGE_MAX_LENGTH })
  body: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender: User;
}
