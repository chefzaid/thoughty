import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryColumn } from 'typeorm';
import { Entry } from './entry.entity';
import { User } from './user.entity';

/** Marks a memoir entry that tells the story of an old photo (a photo prompt), placed in its text. */
@Entity('memoir_photo_answers')
export class MemoirPhotoAnswer {
  @PrimaryColumn({ name: 'entry_id', type: 'integer' })
  entryId: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToOne(() => Entry, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entry_id' })
  entry: Entry;
}
