import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';

/**
 * A conversation between writers. A one-to-one conversation names its two writers, the lower id first, so
 * there is one per pair and it goes when either account is purged.
 */
@Entity('conversations')
@Unique('uq_conversations_direct', ['directLowId', 'directHighId'])
@Check('chk_conversations_direct_order', 'direct_low_id < direct_high_id')
export class Conversation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'direct_low_id', type: 'integer', nullable: true })
  directLowId: number | null;

  @Column({ name: 'direct_high_id', type: 'integer', nullable: true })
  directHighId: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  /** When its newest message was sent; null until the first one, and the list leaves it out until then. */
  @Column({ name: 'last_message_at', type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'direct_low_id' })
  directLow: User | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'direct_high_id' })
  directHigh: User | null;
}
