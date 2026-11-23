import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ContactForm from './ContactForm';

const { authFetch, authState } = vi.hoisted(() => ({
  authFetch: vi.fn(),
  authState: { user: null as { email: string } | null },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ authFetch, user: authState.user }),
}));

const messages: Record<string, string> = {
  contactFormTitle: 'Send a message',
  contactFormIntro: 'It goes by email.',
  contactNameLabel: 'Name',
  contactEmailLabel: 'Email',
  contactMessageLabel: 'Message',
  contactMessageHint: '10 to 5,000 characters.',
  contactSubmit: 'Send message',
  contactSending: 'Sending…',
  contactSuccess: 'Thank you, your message was sent.',
  contactSendError: 'Your message could not be sent.',
  apiError_CONTACT_NOT_SENT: 'The mail server refused it.',
};

const t = (key: string) => messages[key] ?? key;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function fillIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole('textbox', { name: 'Name' }), '  Camille ');
  await user.type(screen.getByRole('textbox', { name: 'Email' }), 'camille@example.com');
  await user.type(screen.getByRole('textbox', { name: 'Message' }), 'How do I export my journal?');
}

describe('ContactForm', () => {
  beforeEach(() => {
    authFetch.mockReset();
    authState.user = null;
  });

  it('labels every field, describes the message limits and keeps the bot trap out of reach', () => {
    const { container } = render(<ContactForm t={t} />);

    const form = screen.getByRole('form', { name: 'Send a message' });
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('maxlength', '100');
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeRequired();
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAttribute('type', 'email');
    const message = screen.getByRole('textbox', { name: 'Message' });
    expect(message).toHaveAttribute('minlength', '10');
    expect(message).toHaveAttribute('maxlength', '5000');
    expect(message).toHaveAccessibleDescription('10 to 5,000 characters.');
    const trap = container.querySelector('input[name="website"]');
    expect(trap).toHaveAttribute('tabindex', '-1');
    expect(trap?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(form).toHaveAttribute('aria-busy', 'false');
  });

  it('fills in a signed-in writer’s address', () => {
    authState.user = { email: 'writer@example.com' };
    render(<ContactForm t={t} />);
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('writer@example.com');
  });

  it('sends the trimmed message, then says so and clears the form', async () => {
    const user = userEvent.setup();
    let answer: (response: Response) => void = () => undefined;
    authFetch.mockReturnValue(new Promise<Response>((resolve) => { answer = resolve; }));
    render(<ContactForm t={t} />);
    await fillIn(user);

    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();
    expect(screen.getByRole('form')).toHaveAttribute('aria-busy', 'true');
    expect(JSON.parse((authFetch.mock.calls[0]?.[1] as RequestInit).body as string)).toEqual({
      name: 'Camille',
      email: 'camille@example.com',
      message: 'How do I export my journal?',
      website: '',
    });

    answer(json({ success: true }, 202));
    expect(await screen.findByText('Thank you, your message was sent.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Thank you, your message was sent.');
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled();
  });

  it('shows the translated API error and keeps what was written', async () => {
    const user = userEvent.setup();
    authFetch.mockResolvedValue(json({ statusCode: 502, message: 'x', error: 'Bad Gateway', code: 'CONTACT_NOT_SENT' }, 502));
    render(<ContactForm t={t} />);
    await fillIn(user);

    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The mail server refused it.');
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('How do I export my journal?');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('clears an earlier error when sending again succeeds', async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    authFetch.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(json({ success: true }, 202));
    render(<ContactForm t={t} />);
    await fillIn(user);

    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your message could not be sent.');

    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('Thank you, your message was sent.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    consoleError.mockRestore();
  });
});
