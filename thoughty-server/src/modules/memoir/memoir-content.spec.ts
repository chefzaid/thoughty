import { composeAnswerContent, countAnswerWords } from './memoir-content';

describe('memoir content', () => {
  it('opens the answer with its question as a heading', () => {
    expect(composeAnswerContent('Où ?', 'Ici.')).toBe('### Où ?\n\nIci.');
    expect(composeAnswerContent('Où ?', '')).toBe('### Où ?');
  });

  it('counts answer words without the question heading', () => {
    expect(countAnswerWords('### What was home like?\n\nA narrow house with a fig tree.')).toBe(7);
    expect(countAnswerWords('### What was home like?')).toBe(0);
    expect(countAnswerWords('No heading here')).toBe(3);
  });

  it('leaves the photos an answer places out of its words', () => {
    expect(countAnswerWords('### What is happening here?\n\n![The bakery, 1962](attachment:7)\n\nGrandpa opens his shop.')).toBe(4);
    expect(countAnswerWords('### What is happening here?\n\n![A photo](attachment:7)')).toBe(0);
  });
});
