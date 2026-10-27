import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PeopleRoute from './PeopleRoute';

vi.mock('../components/People/PeoplePage', () => ({
  default: ({ theme, language }: { theme?: string; language?: string }) => <p>{`People page ${theme} ${language}`}</p>,
}));

describe('PeopleRoute', () => {
  it('shows the People page with the reader’s theme and language', () => {
    render(<PeopleRoute theme="light" language="fr" t={(key) => key} />);

    expect(screen.getByText('People page light fr')).toBeInTheDocument();
  });
});
