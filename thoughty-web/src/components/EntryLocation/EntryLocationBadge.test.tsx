import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import EntryLocationBadge from './EntryLocationBadge';
import { getTranslation } from '../../utils/translations';

const t = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);

describe('EntryLocationBadge', () => {
  it('shows the place by its name, blurred with the entry text, and names it for screen readers', () => {
    const { container } = render(<EntryLocationBadge entry={{ location: { name: 'Annecy', latitude: 45.9, longitude: 6.13 } }} isDark={false} language="fr" t={t} />);

    expect(screen.getByText('Annecy')).toHaveClass('privacy-text');
    expect(container).toHaveTextContent('Lieu: Annecy');
  });

  it('shows coordinates when the place has no name, and nothing without a place', () => {
    const { container, rerender } = render(<EntryLocationBadge entry={{ location: { name: null, latitude: 45.9, longitude: -6.13 } }} isDark language="fr" t={t} />);
    expect(screen.getByText('45,9° N, 6,13° O')).toBeInTheDocument();

    rerender(<EntryLocationBadge entry={{ location: null }} isDark language="fr" t={t} />);
    expect(container).toBeEmptyDOMElement();
  });
});
