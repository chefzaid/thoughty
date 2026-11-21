import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { metricLine } from './prometheus-text';

/** The counts change over days, not seconds, so each API pod runs the queries at most this often. */
export const WRITING_ENGAGEMENT_CACHE_TTL_MS = 15 * 60 * 1000;

export const SIGN_UP_FUNNEL_STAGES = ['signed_up', 'first_entry', 'fifth_entry', 'week_four'] as const;
export type SignUpFunnelStage = (typeof SIGN_UP_FUNNEL_STAGES)[number];

export interface WritingEngagementSnapshot {
  activeWriters7d: number;
  activeWriters28d: number;
  writingDays7d: number;
  funnel: Record<SignUpFunnelStage, number>;
}

/**
 * An entry counts as written when it was saved on the day it is dated, give or take a day for
 * time zones (the writer's day is in their own zone, `created_at` in the server's) and late-night
 * writing; an imported or back-dated entry does not. Entries in the recycle bin still count,
 * accounts being deleted do not.
 */
const WRITTEN_ENTRY = `e.date BETWEEN e.created_at::date - 1 AND e.created_at::date + 1`;

const ACTIVITY_QUERY = `
  WITH per_writer AS (
    SELECT e.user_id,
           LEAST(COUNT(DISTINCT e.date) FILTER (WHERE e.created_at >= LOCALTIMESTAMP - interval '7 days'), 7) AS days_7d
    FROM entries e
    JOIN users u ON u.id = e.user_id AND u.deleted_at IS NULL
    WHERE e.created_at >= LOCALTIMESTAMP - interval '28 days' AND ${WRITTEN_ENTRY}
    GROUP BY e.user_id
  )
  SELECT COUNT(*) FILTER (WHERE days_7d > 0) AS active_7d,
         COUNT(*) AS active_28d,
         COALESCE(SUM(days_7d), 0) AS writing_days_7d
  FROM per_writer`;

/** The accounts created 28 to 56 days ago: every one of them has had its first four weeks. */
const FUNNEL_QUERY = `
  WITH cohort AS (
    SELECT id, created_at FROM users
    WHERE deleted_at IS NULL
      AND created_at >= LOCALTIMESTAMP - interval '56 days'
      AND created_at < LOCALTIMESTAMP - interval '28 days'
  ),
  progress AS (
    SELECT c.id,
           COUNT(e.id) AS written,
           COUNT(e.id) FILTER (WHERE e.created_at >= c.created_at + interval '21 days') AS written_week_four
    FROM cohort c
    LEFT JOIN entries e ON e.user_id = c.id AND e.created_at < c.created_at + interval '28 days' AND ${WRITTEN_ENTRY}
    GROUP BY c.id
  )
  SELECT COUNT(*) AS signed_up,
         COUNT(*) FILTER (WHERE written >= 1) AS first_entry,
         COUNT(*) FILTER (WHERE written >= 5) AS fifth_entry,
         COUNT(*) FILTER (WHERE written_week_four > 0) AS week_four
  FROM progress`;

type CountRow<K extends string> = Record<K, string | number>;

const count = (value: string | number | undefined): number => Number(value ?? 0);

/**
 * The north-star metric (weekly writing days per active writer) and the sign-up funnel, as
 * counts of accounts only: no entry text, no account and no date leaves the database.
 */
@Injectable()
export class WritingEngagementMetricsService {
  private readonly logger = new Logger(WritingEngagementMetricsService.name);
  private cached: { snapshot: WritingEngagementSnapshot; expiresAt: number } | null = null;
  private pending: Promise<WritingEngagementSnapshot | null> | null = null;

  constructor(private readonly dataSource: DataSource) {}

  /** The latest counts, or null when the database cannot answer (the rest of `/api/metrics` still renders). */
  async getSnapshot(now = Date.now()): Promise<WritingEngagementSnapshot | null> {
    if (this.cached && this.cached.expiresAt > now) {
      return this.cached.snapshot;
    }
    this.pending ??= this.load(now).finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private async load(now: number): Promise<WritingEngagementSnapshot | null> {
    try {
      const [activityRows, funnelRows] = await Promise.all([
        this.dataSource.query<CountRow<'active_7d' | 'active_28d' | 'writing_days_7d'>[]>(ACTIVITY_QUERY),
        this.dataSource.query<CountRow<SignUpFunnelStage>[]>(FUNNEL_QUERY),
      ]);
      const activity = activityRows[0];
      const funnel = funnelRows[0];
      const snapshot: WritingEngagementSnapshot = {
        activeWriters7d: count(activity?.active_7d),
        activeWriters28d: count(activity?.active_28d),
        writingDays7d: count(activity?.writing_days_7d),
        funnel: Object.fromEntries(
          SIGN_UP_FUNNEL_STAGES.map((stage) => [stage, count(funnel?.[stage])]),
        ) as Record<SignUpFunnelStage, number>,
      };
      this.cached = { snapshot, expiresAt: now + WRITING_ENGAGEMENT_CACHE_TTL_MS };
      return snapshot;
    } catch (error) {
      this.logger.warn(`Writing engagement metrics unavailable: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}

export function renderWritingEngagement(snapshot: WritingEngagementSnapshot | null): string[] {
  if (!snapshot) {
    return [];
  }
  const perActiveWriter =
    snapshot.activeWriters28d > 0 ? Math.round((snapshot.writingDays7d / snapshot.activeWriters28d) * 1000) / 1000 : 0;

  return [
    '# HELP thoughty_weekly_writing_days_per_active_writer North-star metric: writing days in the last 7 days per writer active in the last 28 days.',
    '# TYPE thoughty_weekly_writing_days_per_active_writer gauge',
    metricLine('thoughty_weekly_writing_days_per_active_writer', perActiveWriter),
    '# HELP thoughty_writing_days_7d Days with a written entry in the last 7 days, summed over writers (at most 7 each).',
    '# TYPE thoughty_writing_days_7d gauge',
    metricLine('thoughty_writing_days_7d', snapshot.writingDays7d),
    '# HELP thoughty_active_writers Accounts with a written entry in the window.',
    '# TYPE thoughty_active_writers gauge',
    metricLine('thoughty_active_writers', snapshot.activeWriters7d, { window: '7d' }),
    metricLine('thoughty_active_writers', snapshot.activeWriters28d, { window: '28d' }),
    '# HELP thoughty_sign_up_funnel_accounts Accounts created 28 to 56 days ago, by the stage they reached in their first four weeks.',
    '# TYPE thoughty_sign_up_funnel_accounts gauge',
    ...SIGN_UP_FUNNEL_STAGES.map((stage) =>
      metricLine('thoughty_sign_up_funnel_accounts', snapshot.funnel[stage], { stage }),
    ),
  ];
}
