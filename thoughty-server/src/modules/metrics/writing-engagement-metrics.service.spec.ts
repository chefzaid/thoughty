import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import {
  renderWritingEngagement,
  WRITING_ENGAGEMENT_CACHE_TTL_MS,
  WritingEngagementMetricsService,
} from './writing-engagement-metrics.service';

const ACTIVITY = [{ active_7d: '2', active_28d: '3', writing_days_7d: '7' }];
const FUNNEL = [{ signed_up: '5', first_entry: '4', fifth_entry: '2', week_four: '1' }];

describe('WritingEngagementMetricsService', () => {
  let query: jest.Mock;
  let service: WritingEngagementMetricsService;

  beforeEach(() => {
    query = jest.fn((sql: string) => Promise.resolve(sql.includes('cohort') ? FUNNEL : ACTIVITY));
    service = new WritingEngagementMetricsService({ query } as unknown as DataSource);
  });

  it('reads the activity and funnel counts as numbers', async () => {
    await expect(service.getSnapshot(0)).resolves.toEqual({
      activeWriters7d: 2,
      activeWriters28d: 3,
      writingDays7d: 7,
      funnel: { signed_up: 5, first_entry: 4, fifth_entry: 2, week_four: 1 },
    });
  });

  it('keeps the counts for the cache period and shares a load already running', async () => {
    await Promise.all([service.getSnapshot(0), service.getSnapshot(0)]);
    await service.getSnapshot(WRITING_ENGAGEMENT_CACHE_TTL_MS - 1);
    expect(query).toHaveBeenCalledTimes(2);

    await service.getSnapshot(WRITING_ENGAGEMENT_CACHE_TTL_MS);
    expect(query).toHaveBeenCalledTimes(4);
  });

  it('reads missing rows as zero', async () => {
    query.mockResolvedValue([]);

    await expect(service.getSnapshot(0)).resolves.toEqual({
      activeWriters7d: 0,
      activeWriters28d: 0,
      writingDays7d: 0,
      funnel: { signed_up: 0, first_entry: 0, fifth_entry: 0, week_four: 0 },
    });
  });

  it('answers null when the database fails, and asks again on the next scrape', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    query.mockRejectedValueOnce(new Error('connection refused'));
    await expect(service.getSnapshot(0)).resolves.toBeNull();
    query.mockRejectedValueOnce('timeout');
    await expect(service.getSnapshot(0)).resolves.toBeNull();

    await expect(service.getSnapshot(0)).resolves.not.toBeNull();
    expect(warn).toHaveBeenCalledWith('Writing engagement metrics unavailable: connection refused');
    expect(warn).toHaveBeenCalledWith('Writing engagement metrics unavailable: timeout');
    warn.mockRestore();
  });
});

describe('renderWritingEngagement', () => {
  const snapshot = {
    activeWriters7d: 2,
    activeWriters28d: 3,
    writingDays7d: 7,
    funnel: { signed_up: 5, first_entry: 4, fifth_entry: 2, week_four: 1 },
  };

  it('renders the north-star metric, its parts and every funnel stage', () => {
    const lines = renderWritingEngagement(snapshot);

    expect(lines).toContain('thoughty_weekly_writing_days_per_active_writer 2.333');
    expect(lines).toContain('thoughty_writing_days_7d 7');
    expect(lines).toContain('thoughty_active_writers{window="7d"} 2');
    expect(lines).toContain('thoughty_active_writers{window="28d"} 3');
    expect(lines).toContain('thoughty_sign_up_funnel_accounts{stage="signed_up"} 5');
    expect(lines).toContain('thoughty_sign_up_funnel_accounts{stage="first_entry"} 4');
    expect(lines).toContain('thoughty_sign_up_funnel_accounts{stage="fifth_entry"} 2');
    expect(lines).toContain('thoughty_sign_up_funnel_accounts{stage="week_four"} 1');
  });

  it('reads 0 days per active writer when nobody wrote, and renders nothing without counts', () => {
    expect(renderWritingEngagement({ ...snapshot, activeWriters28d: 0, writingDays7d: 0 })).toContain(
      'thoughty_weekly_writing_days_per_active_writer 0',
    );
    expect(renderWritingEngagement(null)).toEqual([]);
  });
});
