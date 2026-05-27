import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Entry } from './entry.entity';

type AiChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

@Entity('ai_chat_histories')
@Index('idx_ai_chat_histories_user_id', ['userId'])
@Index('idx_ai_chat_histories_entry_id', ['entryId'])
@Index('idx_ai_chat_histories_user_entry_unique', ['userId', 'entryId'], { unique: true })
export class AiChatHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @Column({ name: 'entry_id', type: 'integer' })
  entryId: number;

  @Column({ type: 'jsonb' })
  messages: AiChatMessage[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Entry, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entry_id' })
  entry: Entry;
}