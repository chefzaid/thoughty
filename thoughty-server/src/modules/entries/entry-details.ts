import type { Entry } from '@/database/entities';
import { entryLocationColumns, normalizeEntryTitle, normalizeFeelings, normalizeMood, normalizeTimeOfDay } from '@/common/utils';
import type { CreateEntryDto, UpdateEntryDto } from './dto';

type EntryDetails = Pick<Entry, 'title' | 'timeOfDay' | 'mood' | 'feelings' | 'locationName' | 'latitude' | 'longitude'>;
type GivenDetails = Pick<CreateEntryDto | UpdateEntryDto, 'title' | 'timeOfDay' | 'mood' | 'feelings' | 'location'>;

/** A new entry's title, time of day, mood, feelings and place, each cleaned; a detail left out is empty. */
export function writtenEntryDetails(dto: GivenDetails): EntryDetails {
  return {
    title: normalizeEntryTitle(dto.title),
    timeOfDay: normalizeTimeOfDay(dto.timeOfDay),
    mood: normalizeMood(dto.mood),
    feelings: normalizeFeelings(dto.feelings),
    ...entryLocationColumns(dto.location),
  };
}

/** Changes the details an edit names (null or empty clears one); those it leaves out stay as they are. */
export function applyEntryDetails(entry: Entry, dto: GivenDetails): void {
  const written = writtenEntryDetails(dto);
  if (dto.title !== undefined) entry.title = written.title;
  if (dto.timeOfDay !== undefined) entry.timeOfDay = written.timeOfDay;
  if (dto.mood !== undefined) entry.mood = written.mood;
  if (dto.feelings !== undefined) entry.feelings = written.feelings;
  if (dto.location !== undefined) {
    entry.locationName = written.locationName;
    entry.latitude = written.latitude;
    entry.longitude = written.longitude;
  }
}
