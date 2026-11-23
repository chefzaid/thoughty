import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import ContactPage from './ContactPage';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ authFetch: vi.fn(), user: null }),
}));

const messages: Record<string, string> = {
  contactEyebrow: 'Support',
  contactTitle: 'Contact and support',
  contactSubtitle: 'Send a question and browse guides.',
  contactFormTitle: 'Send a message',
  contactIdeasBody: 'An idea for a feature?',
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

  it('offers the message form beside the way to the community board', () => {
    renderPage();

    expect(screen.getByRole('form', { name: 'Send a message' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'An idea for a feature?' })).toContainElement(
      screen.getByRole('button', { name: 'Open the community board' }),
    );
  });

  it('always lists the crisis lines', () => {
    renderPage();

    const section = screen.getByRole('region', { name: 'supportTitle' });
    expect(section).toHaveTextContent('supportIntro');
    expect(section).toHaveTextContent('supportNotTherapy');
    expect(screen.getByRole('link', { name: '3114' })).toHaveAttribute('href', 'tel:3114');
    expect(screen.getByRole('link', { name: 'findahelpline.com' })).toHaveAttribute('href', 'https://findahelpline.com');
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
