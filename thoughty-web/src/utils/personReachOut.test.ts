import { describe, expect, it } from 'vitest';

import { reachOutDraft, readReachOutDraft, REACH_OUT_DAYS } from './personReachOut';

describe('person reach-out drafts', () => {
  it('offers the reminders the API takes and fills the draft from a person', () => {
    expect(REACH_OUT_DAYS).toEqual([14, 30, 60, 90, 180, 365]);
    expect(reachOutDraft({ reachOutDays: 30, lastContactOn: '2026-11-03' })).toEqual({ after: '30', lastContactOn: '2026-11-03' });
    expect(reachOutDraft({ reachOutDays: null, lastContactOn: null })).toEqual({ after: '', lastContactOn: '' });
  });

  it('reads the reminder and the last contact, empty fields as none', () => {
    expect(readReachOutDraft({ after: '90', lastContactOn: '2026-11-22' }, '2026-11-22')).toEqual({ reachOutDays: 90, lastContactOn: '2026-11-22' });
    expect(readReachOutDraft({ after: '', lastContactOn: '' }, '2026-11-22')).toEqual({ reachOutDays: null, lastContactOn: null });
    expect(readReachOutDraft({ after: '31', lastContactOn: '' }, '2026-11-22')).toEqual({ reachOutDays: null, lastContactOn: null });
  });

  it('refuses a last contact after the writer’s day', () => {
    expect(readReachOutDraft({ after: '30', lastContactOn: '2026-11-23' }, '2026-11-22')).toEqual({ error: 'apiError_PERSON_CONTACT_IN_FUTURE' });
  });
});
