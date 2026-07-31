import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import PublicAppLayout from './PublicAppLayout';

function RouteFixture() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <PublicAppLayout t={(key) => key}>
      <main>
        <p>{location.pathname}</p>
        <button type="button" onClick={() => navigate('/blog')}>
          Open blog
        </button>
      </main>
    </PublicAppLayout>
  );
}

describe('PublicAppLayout', () => {
  it('provides skip navigation and focuses content after route changes', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/about']}>
        <RouteFixture />
      </MemoryRouter>,
    );

    const content = document.querySelector<HTMLElement>('#public-page-content');
    const skipLink = screen.getByRole('link', { name: 'skipToContent' });

    expect(skipLink).toHaveAttribute('href', '#public-page-content');
    expect(content).toHaveAttribute('tabindex', '-1');

    await user.click(skipLink);
    expect(content).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Open blog' }));
    expect(await screen.findByText('/blog')).toBeVisible();
    expect(content).toHaveFocus();
  });
});
