import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import ContactPage from './ContactPage';

const messages: Record<string, string> = {
  contactEyebrow: 'Support',
  contactTitle: 'Contact and support',
  contactSubtitle: 'Send a question and browse guides.',
  contactClosedTitle: 'Messages cannot be sent from here yet',
  contactClosedBody: 'No inbox receives messages from this page yet.',
  contactOpenFeedback: 'Open the community board',
  contactGuidesKicker: 'Guides',
  contactGuidesTitle: 'How to guides',
  contactGuideStartTitle: 'Start writing',
  contactGuideStartBody: 'Create entries with tags.',
  contactGuideImportTitle: 'Import notes',
  contactGuideImportBody: 'Preview imports first.',
  contactGuidePrivacyTitle: 'Manage privacy',
  contactGuidePrivacyBody: 'Choose visibility.',
  contactFaqKicker: 'FAQ',
  contactFaqTitle: 'Frequently asked questions',
  contactFaqDataTitle: 'Can I export data?',
  contactFaqDataBody: 'Yes.',
  contactFaqAiTitle: 'Does AI read everything?',
  contactFaqAiBody: 'No.',
  contactFaqExportTitle: 'Which formats are supported?',
  contactFaqExportBody: 'Several.',
  back: 'Back',
  copyright: 'Copyright',
  madeWithLove: 'Made with care',
  about: 'About',
  privacy: 'Privacy',
  terms: 'Terms',
  contact: 'Contact',
};

function t(key: string) {
  return messages[key] ?? key;
}

const renderPage = (overrides: Partial<{ onBackHome: () => void; onOpenFeedback: () => void }> = {}) => render(
  <ContactPage t={t} theme="dark" onBackHome={vi.fn()} onOpenFeedback={vi.fn()} {...overrides} />,
);

describe('ContactPage', () => {
  it('renders the guides and FAQ content', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Contact and support' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How to guides' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Frequently asked questions' })).toBeInTheDocument();
  });

  it('offers no message form while no inbox receives messages, and says so', () => {
    const { container } = renderPage();

    expect(container.querySelector('form, input, textarea, select')).toBeNull();
    expect(screen.queryByText(/sent|ready/i, { selector: 'output, [role="status"]' })).not.toBeInTheDocument();
    const panel = screen.getByRole('region', { name: 'Messages cannot be sent from here yet' });
    expect(panel).toHaveTextContent('No inbox receives messages from this page yet.');
  });

  it('opens the community board from the panel', async () => {
    const user = userEvent.setup();
    const onOpenFeedback = vi.fn();
    renderPage({ onOpenFeedback });

    await user.click(screen.getByRole('button', { name: 'Open the community board' }));

    expect(onOpenFeedback).toHaveBeenCalledOnce();
  });

  it('navigates back home from the hero action', async () => {
    const user = userEvent.setup();
    const onBackHome = vi.fn();
    renderPage({ onBackHome });

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBackHome).toHaveBeenCalledOnce();
  });
});
