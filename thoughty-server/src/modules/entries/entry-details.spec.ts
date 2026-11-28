import type { Entry } from '@/database/entities';
import { applyEntryDetails, writtenEntryDetails } from './entry-details';

describe('entry details', () => {
  it('cleans each detail of a new entry, and leaves the missing ones empty', () => {
    expect(writtenEntryDetails({ title: '  A walk ', timeOfDay: '8:30', mood: 4, feelings: ['Calm'], location: { name: ' Lake ' } })).toEqual({
      title: 'A walk',
      timeOfDay: '08:30',
      mood: 4,
      feelings: ['calm'],
      locationName: 'Lake',
      latitude: null,
      longitude: null,
    });
    expect(writtenEntryDetails({})).toEqual({
      title: null,
      timeOfDay: null,
      mood: null,
      feelings: [],
      locationName: null,
      latitude: null,
      longitude: null,
    });
  });

  it('changes only the details an edit names, and clears the place with null', () => {
    const entry = { title: 'Kept', timeOfDay: '09:00', mood: 2, feelings: ['tired'], locationName: 'Home', latitude: 1, longitude: 2 } as Entry;

    applyEntryDetails(entry, { mood: 5 });
    expect(entry).toMatchObject({ title: 'Kept', timeOfDay: '09:00', mood: 5, feelings: ['tired'], locationName: 'Home', latitude: 1, longitude: 2 });

    applyEntryDetails(entry, { location: { latitude: 45.5, longitude: 6.25 } });
    expect(entry).toMatchObject({ locationName: null, latitude: 45.5, longitude: 6.25 });

    applyEntryDetails(entry, { title: null, timeOfDay: null, feelings: [], location: null });
    expect(entry).toMatchObject({ title: null, timeOfDay: null, mood: 5, feelings: [], locationName: null, latitude: null, longitude: null });
  });
});
