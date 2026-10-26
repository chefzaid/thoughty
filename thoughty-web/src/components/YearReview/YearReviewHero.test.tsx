import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { YearReview } from '../../services/api';
import { getTranslation } from '../../utils/translations';
import YearReviewHero from './YearReviewHero';

const review = (averageWords: number): YearReview => ({
  year: 2025,
  diaryId: null,
  availableYears: [2025],
  totals: { entries: 1, words: averageWords, writingDays: 1, longestStreak: 1, favorites: 0, attachments: 0, averageWords },
  previousYear: null,
  months: [],
  weekdays: [],
  topTags: [],
  newTags: [],
  highlights: [],
  mood: null,
  recordedMood: null,
  aiAvailable: false,
});

describe('YearReviewHero', () => {
  it.each([
    ['en', 1, 'Average entry length: 1 word'],
    ['en', 286, 'Average entry length: 286 words'],
    ['fr', 0, 'Longueur moyenne d’une entrée : 0 mot'],
    ['fr', 1, 'Longueur moyenne d’une entrée : 1 mot'],
    ['fr', 286, 'Longueur moyenne d’une entrée : 286 mots'],
  ] as const)('writes the average entry length in %s (%i)', (language, averageWords, expected) => {
    render(<YearReviewHero review={review(averageWords)} language={language} t={(key, params) => getTranslation(language, key, params)} />);

    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
