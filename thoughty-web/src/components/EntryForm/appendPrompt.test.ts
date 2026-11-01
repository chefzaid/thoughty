import { describe, expect, it } from 'vitest';

import { appendPrompt } from './appendPrompt';

describe('appendPrompt', () => {
  it('fills an empty draft with the question and adds it after a blank line otherwise', () => {
    expect(appendPrompt('', 'What made you smile?')).toBe('What made you smile?');
    expect(appendPrompt('  \n', 'What made you smile?')).toBe('What made you smile?');
    expect(appendPrompt('Today', 'What made you smile?')).toBe('Today\n\nWhat made you smile?');
  });
});
