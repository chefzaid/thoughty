import { ApiProperty } from '@nestjs/swagger';

export class LikeStateDto {
  @ApiProperty({ example: true, description: 'Whether the current user likes the item' })
  liked!: boolean;

  @ApiProperty({ example: 4, description: 'Likes by active users' })
  likeCount!: number;
}
