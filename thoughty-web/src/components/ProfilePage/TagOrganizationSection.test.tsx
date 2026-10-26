import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getTranslation } from '../../utils/translations';
import TagOrganizationSection from './TagOrganizationSection';

describe('TagOrganizationSection', () => {
  it.each([
    ['en', ['Unused', '1 entry', '2 entries']],
    ['fr', ['Inutilisé', '1 entrée', '2 entrées']],
  ] as const)('counts how many entries use each tag in %s', (language, labels) => {
    render(
      <TagOrganizationSection
        allTags={['alpha', 'beta', 'gamma']}
        localConfig={{ language }}
        setLocalConfig={vi.fn()}
        renameDrafts={{}}
        setRenameDrafts={vi.fn()}
        tagUsage={{ alpha: 0, beta: 1, gamma: 2 }}
        isDark={false}
        t={(key, params) => getTranslation(language, key, params)}
      />,
    );

    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
