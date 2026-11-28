// An entry's optional place: a name, coordinates, or both.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { MAX_LOCATION_NAME_LENGTH } from '@/common/utils/entry-location.util';
import { StrictNumber } from '@/common/validation';

/** Coordinates come as a pair: either one given makes both required. */
const hasCoordinates = (location: EntryLocationDto): boolean =>
  (location.latitude !== null && location.latitude !== undefined) || (location.longitude !== null && location.longitude !== undefined);

/** A place as a request gives it; a place with neither a name nor coordinates is no place. */
export class EntryLocationDto {
  @ApiPropertyOptional({
    description: 'The place as the writer names it, on one line',
    type: String,
    nullable: true,
    maxLength: MAX_LOCATION_NAME_LENGTH,
    example: 'Jardin du Luxembourg, Paris',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LOCATION_NAME_LENGTH, { message: `Place name exceeds maximum length of ${MAX_LOCATION_NAME_LENGTH} characters` })
  @Matches(/^[^\r\n]*$/, { message: 'Place name must be one line' })
  name?: string | null;

  @ApiPropertyOptional({ description: 'Latitude in degrees, with `longitude`', type: Number, format: 'double', nullable: true, minimum: -90, maximum: 90, example: 48.8462 })
  @ValidateIf(hasCoordinates)
  @StrictNumber({ message: 'Latitude must be a number from -90 to 90, given with the longitude' })
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @ApiPropertyOptional({ description: 'Longitude in degrees, with `latitude`', type: Number, format: 'double', nullable: true, minimum: -180, maximum: 180, example: 2.3372 })
  @ValidateIf(hasCoordinates)
  @StrictNumber({ message: 'Longitude must be a number from -180 to 180, given with the latitude' })
  @Min(-180)
  @Max(180)
  longitude?: number | null;
}

/** The place an entry was written, as the entries API answers it. */
export class EntryLocationResponseDto {
  @ApiProperty({ type: String, nullable: true, example: 'Jardin du Luxembourg, Paris' })
  name: string | null;

  @ApiProperty({ type: Number, format: 'double', nullable: true, description: 'Latitude in degrees, or null without coordinates', example: 48.8462 })
  latitude: number | null;

  @ApiProperty({ type: Number, format: 'double', nullable: true, description: 'Longitude in degrees, or null without coordinates', example: 2.3372 })
  longitude: number | null;
}
