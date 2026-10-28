import { ApiProperty } from '@nestjs/swagger';
import { SHARE_LINK_KINDS, type ShareLinkKind } from './share-link.dto';

/** One of the shared entry's files, by its ID within the link (never its storage key). */
export class SharedAttachmentDto {
  @ApiProperty({ example: 31, description: 'What `attachment:31` in the text, and the link’s attachment route, name' })
  id!: number;

  @ApiProperty({ example: 'beach.jpg' })
  name!: string;

  @ApiProperty({ example: 'image/jpeg' })
  mimetype!: string;

  @ApiProperty({ example: 48213 })
  size!: number;

  @ApiProperty({ example: false, description: 'Whether a video has a poster frame to show before it plays' })
  hasPoster!: boolean;
}

/** The entry as its reader sees it: no diary, people, history or anything else of the writer's. */
export class SharedEntryDto {
  @ApiProperty({ example: '2026-10-27', format: 'date' })
  date!: string;

  @ApiProperty({ type: String, nullable: true, example: '08:30' })
  timeOfDay!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'A walk by the sea' })
  title!: string | null;

  @ApiProperty({ example: 'We walked to the lighthouse.' })
  content!: string;

  @ApiProperty({ enum: ['plain', 'markdown'], example: 'markdown' })
  format!: 'plain' | 'markdown';

  @ApiProperty({ type: Number, nullable: true, example: 4, description: 'Null unless the writer chose to show it' })
  mood!: number | null;

  @ApiProperty({ type: [String], example: ['calm'], description: 'Empty unless the writer chose to show the mood' })
  feelings!: string[];

  @ApiProperty({ type: [String], example: ['family'], description: 'Empty unless the writer chose to show them' })
  tags!: string[];

  @ApiProperty({ type: [SharedAttachmentDto] })
  attachments!: SharedAttachmentDto[];
}

export class SharedBookVersionDto {
  @ApiProperty({ example: 'Summer 2026' })
  title!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Zaid' })
  author!: string | null;

  @ApiProperty({ example: 'pdf' })
  format!: string;

  @ApiProperty({ example: 'summer-2026-v3.pdf' })
  filename!: string;

  @ApiProperty({ example: 1048576, description: 'Bytes' })
  size!: number;
}

export class SharedContentResponseDto {
  @ApiProperty({ enum: SHARE_LINK_KINDS, example: 'entry' })
  kind!: ShareLinkKind;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-11-04T09:30:00.000Z' })
  expiresAt!: Date;

  @ApiProperty({ type: SharedEntryDto, nullable: true, description: 'The entry, for an entry link' })
  entry!: SharedEntryDto | null;

  @ApiProperty({ type: SharedBookVersionDto, nullable: true, description: 'The book file, for a book version link' })
  bookVersion!: SharedBookVersionDto | null;
}
