import { describe, expect, it } from 'vitest';
import { LOCAL_MODEL_PROMPTS } from '../../generated/localModelPrompts';
import { followUpMessages, parseFollowUps, parseInspiration, summarizeThemes } from './localModelWritingPrompts';
import { chatMessages, jsonCandidate, rephraseMessages } from './localModelPrompts';

describe('the server’s prompts in the web app', () => {
  it('are the server’s own instructions, generated from it', () => {
    expect(rephraseMessages('x', 'grammar')[0]?.content).toBe(LOCAL_MODEL_PROMPTS.fixWriting.grammar);
    expect(chatMessages('An entry', [])).toEqual([
      { role: 'system', content: `${LOCAL_MODEL_PROMPTS.entryChat}\n\n<journal_entry>\nAn entry\n</journal_entry>` },
    ]);
  });

  it('find the JSON a model wraps in prose', () => {
    expect(jsonCandidate(' {"a":1} ', '{')).toBe('{"a":1}');
    expect(jsonCandidate('Here: [1, 2] done', '[')).toBe('[1, 2]');
    expect(jsonCandidate('nothing', '{')).toBeUndefined();
  });
});

describe('Get Inspired on the writer’s own model', () => {
  it('counts the most used tags across the newest entries and lists those of the most recent ones', () => {
    const entryTags = Array.from({ length: 250 }, (_, index) => (index < 200 ? ['rest', ` t${index % 30} `] : ['old']));
    const { themes, recentThemes } = summarizeThemes(entryTags);

    expect(themes).toHaveLength(LOCAL_MODEL_PROMPTS.inspirationLimits.themes);
    expect(themes[0]).toEqual({ tag: 'rest', count: 200 });
    expect(themes.some(({ tag }) => tag === 'old')).toBe(false);
    // The 12 most recent entries hold 13 tags
    expect(recentThemes).toHaveLength(13);
    expect(recentThemes.slice(0, 3)).toEqual(['rest', 't0', 't1']);
    const twoEach = Array.from({ length: 12 }, (_, index) => [`a${index}`, `b${index}`]);
    expect(summarizeThemes(twoEach).recentThemes).toHaveLength(LOCAL_MODEL_PROMPTS.inspirationLimits.recentThemes);
    expect(summarizeThemes([['b', 'a'], ['a', 'b', 'b']]).themes).toEqual([{ tag: 'a', count: 2 }, { tag: 'b', count: 2 }]);
  });

  it('reads the question without fences, quotes or anything past its limit', () => {
    expect(parseInspiration('```text\n“What did you notice today?”\n```')).toBe('What did you notice today?');
    expect(parseInspiration(`'${'a'.repeat(500)}'`)).toHaveLength(LOCAL_MODEL_PROMPTS.inspirationLimits.questionLength);
  });
});

describe('memoir follow-ups on the writer’s own model', () => {
  it('send a long answer as its opening and its most recent part', () => {
    const answer = `${'a'.repeat(5000)}${'b'.repeat(10_000)}`;
    const user = followUpMessages({ question: 'Q', answer, asked: [] })[1]?.content ?? '';

    expect(user).toContain(`<memoir_answer>\n${'a'.repeat(4000)}\n…\n${'b'.repeat(8000)}\n</memoir_answer>`);
    expect(user).toContain('<already_asked>\n\n</already_asked>');
  });

  it('read at most three new questions, each on one line, and nothing from what is not the JSON asked for', () => {
    const many = JSON.stringify({ questions: ['One?', `Two\n  ${'x'.repeat(300)}`, 'Three?', 'Four?', 3, '', 'one'] });
    const questions = parseFollowUps(many, []);

    expect(questions).toHaveLength(3);
    expect(questions?.[0]).toBe('One?');
    expect(questions?.[1]).toHaveLength(LOCAL_MODEL_PROMPTS.memoirFollowUpLimits.questionLength);
    expect(parseFollowUps('{"questions":["Already?"]}', ['already'])).toEqual([]);
    expect(parseFollowUps('{"questions":"one"}', [])).toBeNull();
    expect(parseFollowUps('{broken}', [])).toBeNull();
    expect(parseFollowUps('no json', [])).toBeNull();
  });
});
