import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import ContactPage from './ContactPage';

const messages: Record<string, string> = {
  contactEyebrow: 'Support',
  contactTitle: 'Contact and support',
  contactSubtitle: 'Send a question and browse guides.',
  contactFormTitle: 'Send a message',
  contactNameLabel: 'Name',
  contactEmailLabel: 'Email',
  contactTopicLabel: 'Topic',
  contactTopicSupport: 'Support',
  contactTopicAccount: 'Account',
  contactTopicBilling: 'Billing',
  contactTopicPrivacy: 'Privacy',
  contactTopicFeedback: 'Feedback',
  contactMessageLabel: 'Message',
  contactSubmit: 'Send message',
  contactSuccessTitle: 'Message ready',
  contactSuccessBody: 'Thanks for reaching out.',
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

describe('ContactPage', () => {
  it('renders the support form, guides, and FAQ content', () => {
    render(<ContactPage t={t} theme="dark" onBackHome={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Contact and support' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How to guides' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Frequently asked questions' })).toBeInTheDocument();
  });

  it('shows a confirmation after the form is submitted', async () => {
    const user = userEvent.setup();
    render(<ContactPage t={t} theme="light" onBackHome={vi.fn()} />);

    await user.type(screen.getByLabelText('Name'), 'Ada');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Message'), 'I need help with exports.');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(screen.getByRole('status')).toHaveTextContent('Message ready');
  });

  it('navigates back home from the hero action', async () => {
    const user = userEvent.setup();
    const onBackHome = vi.fn();
    render(<ContactPage t={t} theme="dark" onBackHome={onBackHome} />);

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBackHome).toHaveBeenCalledOnce();
  });
});
