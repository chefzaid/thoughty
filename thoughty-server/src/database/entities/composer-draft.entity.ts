import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

/**
 * The text the writer is composing in the new-entry composer, saved as they type so it continues on
 * another device. One per writer, like the composer itself, which keeps its text across diaries and
 * views; publishing or discarding it removes the row. `revision` grows by one with every save, so a
 * device that saves on top of a revision it never saw is refused instead of overwriting newer text.
 */
@Entity('composer_drafts')
export class ComposerDraft {
  @PrimaryColumn({ name: 'user_id', type: 'integer' })
  userId: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title: string | null;

  @Column({ type: 'text' })
  content: string;

  @Column('text', { array: true, default: [] })
  tags: string[];

  @Column({ type: 'varchar', length: 20, default: 'plain' })
  format: 'plain' | 'markdown';

  @Column({ type: 'smallint', nullable: true })
  mood: number | null;

  @Column('text', { array: true, default: [] })
  feelings: string[];

  @Column({ type: 'integer', default: 1 })
  revision: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
