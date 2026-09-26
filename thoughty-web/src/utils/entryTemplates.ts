import type { Config } from '../types';

export interface EntryTemplate {
  id: string;
  name: string;
  content: string;
  tags: string[];
  visibility: 'public' | 'private';
  format: 'plain' | 'markdown';
  builtIn?: boolean;
}

export interface EntryTemplateDraft {
  name: string;
  content: string;
  tags: string[];
  visibility: 'public' | 'private';
  format: 'plain' | 'markdown';
}

const DEFAULT_ENTRY_TEMPLATES: EntryTemplate[] = [
  {
    id: 'builtin-gratitude',
    name: 'Gratitude journal',
    content: "Today I am grateful for:\n\n1. \n2. \n3. \n\nOne small moment I want to remember:",
    tags: ['gratitude'],
    visibility: 'private',
    format: 'plain',
    builtIn: true,
  },
  {
    id: 'builtin-daily-reflection',
    name: 'Daily reflection',
    content: "What happened today?\n\nWhat did I learn?\n\nWhat should I carry into tomorrow?",
    tags: ['reflection'],
    visibility: 'private',
    format: 'plain',
    builtIn: true,
  },
  {
    id: 'builtin-morning-intentions',
    name: 'Morning intentions',
    content: "How I feel as I start the day:\n\nThe one thing that would make today a good day:\n\nWhat might get in the way, and how I'll handle it:\n\nHow I want to show up for the people around me:",
    tags: ['morning', 'intentions'],
    visibility: 'private',
    format: 'plain',
    builtIn: true,
  },
  {
    id: 'builtin-weekly-review',
    name: 'Weekly review',
    content: "## Wins\n- \n\n## What was hard\n- \n\n## What I learned\n- \n\n## What I'm letting go of\n- \n\n## Focus for next week\n1. \n2. \n3. ",
    tags: ['weekly-review'],
    visibility: 'private',
    format: 'markdown',
    builtIn: true,
  },
  {
    id: 'builtin-decision-notes',
    name: 'Decision notes',
    content: "## The decision\n\n## Context\n\n## Options I considered\n- \n\n## What I chose and why\n\n## What I'm giving up\n\n## What would change my mind\n\n## Revisit on\n",
    tags: ['decision'],
    visibility: 'private',
    format: 'markdown',
    builtIn: true,
  },
  {
    id: 'builtin-rant',
    name: 'Rant it out',
    content: "What's bothering me (no filter, no judgment):\n\n\nWhat's really underneath it:\n\nWhat's in my control, and what isn't:\n\nOne kind thing I can do for myself now:",
    tags: ['rant'],
    visibility: 'private',
    format: 'plain',
    builtIn: true,
  },
  {
    id: 'builtin-worry-check',
    name: 'Worry check',
    content: "The situation:\n\nThe thought running through my head:\n\nHow it makes me feel (and how strongly, 0–10):\n\nEvidence that supports it:\n\nEvidence against it:\n\nA more balanced way to see it:",
    tags: ['anxiety'],
    visibility: 'private',
    format: 'plain',
    builtIn: true,
  },
  {
    id: 'builtin-philosophical-musing',
    name: 'Philosophical musing',
    content: "A question I keep coming back to:\n\nWhat I currently believe, and why:\n\nThe strongest argument against my view:\n\nIf I'm wrong, what changes?\n\nWhere I've landed for now:",
    tags: ['philosophy'],
    visibility: 'private',
    format: 'plain',
    builtIn: true,
  },
  {
    id: 'builtin-life-check-in',
    name: 'Life check-in',
    content: "Rate each area from 1 to 10, then add a note.\n\n- **Health:** \n- **Relationships:** \n- **Work or purpose:** \n- **Money:** \n- **Growth:** \n- **Fun and rest:** \n\nThe area that needs the most attention:\n\nOne step I'll take this month:",
    tags: ['life', 'check-in'],
    visibility: 'private',
    format: 'markdown',
    builtIn: true,
  },
  {
    id: 'builtin-values-reflection',
    name: 'Values reflection',
    content: "Three values that matter most to me right now:\n\n1. \n2. \n3. \n\nWhere I lived them recently:\n\nWhere I drifted from them:\n\nWhat living them more fully would look like:",
    tags: ['values'],
    visibility: 'private',
    format: 'plain',
    builtIn: true,
  },
  {
    id: 'builtin-letter-to-future-self',
    name: 'Letter to my future self',
    content: "Dear future me,\n\nRight now, my life looks like this:\n\nWhat I'm hoping for:\n\nWhat I'm afraid of:\n\nWhat I want you to remember:\n\n",
    tags: ['future-self'],
    visibility: 'private',
    format: 'plain',
    builtIn: true,
  },
  {
    id: 'builtin-unsent-letter',
    name: 'Unsent letter',
    content: "Dear ,\n\nWhat I never got to say:\n\n",
    tags: ['unsent-letter'],
    visibility: 'private',
    format: 'plain',
    builtIn: true,
  },
  {
    id: 'builtin-dream-log',
    name: 'Dream log',
    content: "What happened in the dream:\n\nPeople, places, and symbols:\n\nHow I felt when I woke up:\n\nWhat it might be connected to in my life:",
    tags: ['dreams'],
    visibility: 'private',
    format: 'plain',
    builtIn: true,
  },
];

function isEntryTemplate(value: unknown): value is EntryTemplate {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<EntryTemplate>;
  return typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.content === 'string'
    && Array.isArray(candidate.tags)
    && candidate.tags.every((tag) => typeof tag === 'string')
    && (candidate.visibility === 'public' || candidate.visibility === 'private')
    && (candidate.format === 'plain' || candidate.format === 'markdown');
}

export function parseCustomEntryTemplates(rawTemplates?: Config['entryTemplates']): EntryTemplate[] {
  if (!rawTemplates || typeof rawTemplates !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(rawTemplates) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isEntryTemplate).map((template) => ({ ...template, builtIn: false }));
  } catch {
    return [];
  }
}

export function serializeCustomEntryTemplates(templates: EntryTemplate[]): string {
  return JSON.stringify(
    templates
      .filter((template) => !template.builtIn)
      .map(({ id, name, content, tags, visibility, format }) => ({
        id,
        name,
        content,
        tags,
        visibility,
        format,
      })),
  );
}

export function getEntryTemplates(rawTemplates?: Config['entryTemplates']): EntryTemplate[] {
  return [...DEFAULT_ENTRY_TEMPLATES, ...parseCustomEntryTemplates(rawTemplates)];
}

export function createEntryTemplate(draft: EntryTemplateDraft): EntryTemplate {
  return {
    id: `custom-${Date.now()}`,
    name: draft.name.trim(),
    content: draft.content,
    tags: [...draft.tags],
    visibility: draft.visibility,
    format: draft.format,
    builtIn: false,
  };
}
