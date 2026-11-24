import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCAL_MODEL_PROMPTS, LOCAL_MODEL_PROMPTS_WEB_PATH, renderLocalModelPromptsModule } from './local-model-prompts';
import { CLINICAL_TERMS } from './year-mood-analysis';

describe('local model prompts', () => {
  it('are the web app’s, so a diary on the writer’s own model gets this server’s prompts (run `npm run api:sync` after a change)', () => {
    const webModule = readFileSync(join(__dirname, '../../..', LOCAL_MODEL_PROMPTS_WEB_PATH), 'utf8');
    expect(webModule).toBe(renderLocalModelPromptsModule());
  });

  it('carry every rephrasing mode, the chat’s safety rules and a diagnosis filter the browser can rebuild', () => {
    expect(Object.keys(LOCAL_MODEL_PROMPTS.fixWriting)).toEqual(['grammar', 'polish', 'rewrite']);
    expect(LOCAL_MODEL_PROMPTS.fixWriting.grammar).toMatch(/^You are a proofreader\..*<text> block/);
    expect(LOCAL_MODEL_PROMPTS.entryChat).toContain('You are not a therapist');
    const clinical = new RegExp(LOCAL_MODEL_PROMPTS.clinicalTerms.source, LOCAL_MODEL_PROMPTS.clinicalTerms.flags);
    expect(clinical.source).toBe(CLINICAL_TERMS.source);
    expect(clinical.test('Is this depression?')).toBe(true);
  });

  it('render as a typed module whose constant is the prompts', () => {
    const rendered = renderLocalModelPromptsModule();
    expect(rendered).toMatch(/^\/\/ Written by `npm run prompts:export`/);
    const json = rendered.slice(rendered.indexOf('= ') + 2, rendered.lastIndexOf(' as const;'));
    expect(JSON.parse(json)).toEqual(LOCAL_MODEL_PROMPTS);
  });
});
