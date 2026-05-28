export type ConverterTestEntry = {
  date: string;
  index: number;
  tags: string[];
  content: string;
  format: 'plain' | 'markdown';
  visibility?: 'public' | 'private';
  diaryName?: string;
};

export const createEntry = (
  overrides: Partial<ConverterTestEntry> = {},
): ConverterTestEntry => ({
  date: '2024-01-15',
  index: 1,
  tags: [],
  content: 'Test entry',
  format: 'plain',
  ...overrides,
});