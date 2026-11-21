import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { StrictInt, WritersTimeZone } from '@/common/validation';
import { ACCESS_TOKEN_SCOPES, type AccessTokenScope } from '@/database/entities';

/** How many tokens a writer can hold at once, expired ones aside. */
export const ACCESS_TOKEN_LIMIT = 10;
export const ACCESS_TOKEN_NAME_MAX_LENGTH = 60;
/** The lifetimes a token can be given, in days; null makes one that never expires. */
export const ACCESS_TOKEN_EXPIRY_DAYS = [30, 90, 365] as const;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreatePersonalAccessTokenDto {
  @ApiProperty({ example: 'iPhone Shortcut', minLength: 1, maxLength: ACCESS_TOKEN_NAME_MAX_LENGTH, description: 'The writer’s own name for the token' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(ACCESS_TOKEN_NAME_MAX_LENGTH)
  @Matches(/^[^\r\n]*$/, { message: 'The name must be one line' })
  name!: string;

  @ApiProperty({
    enum: ACCESS_TOKEN_SCOPES,
    isArray: true,
    example: ['entries:write'],
    description: '`entries:read` lists diaries and entries; `entries:write` lists diaries and writes new entries',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(ACCESS_TOKEN_SCOPES, { each: true })
  scopes!: AccessTokenScope[];

  @ApiProperty({
    type: Number,
    nullable: true,
    enum: ACCESS_TOKEN_EXPIRY_DAYS,
    example: 90,
    description: 'Days until the token stops working; null for a token that never expires',
  })
  @ValidateIf((_dto, value) => value !== null)
  @StrictInt()
  @IsIn(ACCESS_TOKEN_EXPIRY_DAYS)
  expiresInDays!: (typeof ACCESS_TOKEN_EXPIRY_DAYS)[number] | null;

  @ApiProperty({
    example: 'Europe/Paris',
    description: 'The browser’s IANA time zone: an entry written through the token without a date gets that zone’s day',
  })
  @WritersTimeZone()
  timeZone!: string;
}

/** A token as its writer sees it; never with the token itself, which only the creation answer carries. */
export class PersonalAccessTokenDto {
  @ApiProperty({ example: 3 })
  id!: number;

  @ApiProperty({ example: 'iPhone Shortcut' })
  name!: string;

  @ApiProperty({ example: 'thy_a1B2', description: 'The token’s first characters, to tell tokens apart' })
  hint!: string;

  @ApiProperty({ enum: ACCESS_TOKEN_SCOPES, isArray: true, example: ['entries:write'] })
  scopes!: AccessTokenScope[];

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: '2027-02-19T09:30:00.000Z', description: 'Null for a token that never expires' })
  expiresAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: '2026-11-21T08:12:00.000Z', description: 'Null when never used' })
  lastUsedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-11-21T08:00:00.000Z' })
  createdAt!: Date;
}

export class PersonalAccessTokenListResponseDto {
  @ApiProperty({ type: [PersonalAccessTokenDto], description: 'Unexpired tokens, newest first' })
  tokens!: PersonalAccessTokenDto[];

  @ApiProperty({ example: ACCESS_TOKEN_LIMIT, description: 'How many tokens the writer can hold at once' })
  limit!: number;
}

export class CreatedPersonalAccessTokenResponseDto extends PersonalAccessTokenDto {
  @ApiProperty({
    example: 'thy_a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V',
    description: 'The token, shown this once: send it as `Authorization: Bearer <token>` to `/api/v1`',
  })
  token!: string;
}
