import { metricLine } from './prometheus-text';

describe('metricLine', () => {
  it('writes a sample without labels, and a value that is not a finite number as 0', () => {
    expect(metricLine('thoughty_database_up', 1)).toBe('thoughty_database_up 1');
    expect(metricLine('thoughty_ratio', Number.NaN)).toBe('thoughty_ratio 0');
  });

  it('escapes backslashes, quotes and new lines in label values', () => {
    expect(metricLine('thoughty_sample', 2, { path: 'a\\b"c\nd', status: 200 })).toBe(
      String.raw`thoughty_sample{path="a\\b\"c\nd",status="200"} 2`,
    );
  });
});
