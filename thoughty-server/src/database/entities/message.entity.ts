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
import { Entry } from './entry.entity';
import { User } from './user.entity';

/** How long a message may be, in characters. */
export const MESSAGE_MAX_LENGTH = 2000;

/** A message in a conversation, kept as plain text, which may share one of its sender's public entries. */
@Entity('messages')
@Index('idx_messages_conversation', ['conversationId', 'id'])
@Index('idx_messages_entry', ['entryId'], { where: 'entry_id IS NOT NULL' })
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'conversation_id', type: 'integer' })
  conversationId: number;

  @Column({ name: 'sender_id', type: 'integer' })
  senderId: number;

  @Column({ type: 'varchar', length: MESSAGE_MAX_LENGTH })
  body: string;

  /** The sender's public entry the message shares; cleared when that entry is deleted for good. */
  @Column({ name: 'entry_id', type: 'integer', nullable: true })
  entryId: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @ManyToOne(() => Entry, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'entry_id' })
  entry: Entry | null;
}
