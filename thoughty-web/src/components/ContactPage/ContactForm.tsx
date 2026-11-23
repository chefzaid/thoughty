import { SubmitEvent, useMemo, useState } from 'react';

import { useAuth } from '../../contexts/AuthContext';
import { createContactService } from '../../services/api/contactService';

/** The API's limits (`ContactMessageDto`), so the browser stops a message it would refuse. */
const NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 254;
const MESSAGE_MIN_LENGTH = 10;
const MESSAGE_MAX_LENGTH = 5000;

interface ContactFormProps {
  readonly t: (key: string, params?: Record<string, string | number>) => string;
}

const fieldText = (data: FormData, name: string): string => {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
};

/**
 * The Contact page form: the API emails each message to the deployment's inbox (`POST /api/contact`), with the
 * visitor's address to reply to. A signed-in writer's address is filled in. `website` is a bot trap, hidden from
 * people and assistive technology.
 */
function ContactForm({ t }: Readonly<ContactFormProps>) {
  const { authFetch, user } = useAuth();
  const contactService = useMemo(() => createContactService(authFetch), [authFetch]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setSending(true);
    setSent(false);
    setError(null);
    const failure = await contactService.send(
      {
        name: fieldText(data, 'name'),
        email: fieldText(data, 'email'),
        message: fieldText(data, 'message'),
        website: fieldText(data, 'website'),
      },
      'contactSendError',
    );
    setSending(false);
    if (failure) {
      setError(t(failure));
      return;
    }
    form.reset();
    setSent(true);
  }

  return (
    <form className="contact-panel contact-form" aria-labelledby="contact-form-title" aria-busy={sending} onSubmit={handleSubmit}>
      <h2 id="contact-form-title">{t('contactFormTitle')}</h2>
      <p>{t('contactFormIntro')}</p>
      <div className="contact-honeypot" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <label>
        <span>{t('contactNameLabel')}</span>
        <input name="name" autoComplete="name" required maxLength={NAME_MAX_LENGTH} />
      </label>
      <label>
        <span>{t('contactEmailLabel')}</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={EMAIL_MAX_LENGTH}
          defaultValue={user?.email ?? ''}
        />
      </label>
      <label>
        <span>{t('contactMessageLabel')}</span>
        <textarea
          name="message"
          rows={6}
          required
          minLength={MESSAGE_MIN_LENGTH}
          maxLength={MESSAGE_MAX_LENGTH}
          aria-describedby="contact-message-hint"
        />
      </label>
      <p id="contact-message-hint" className="contact-hint">{t('contactMessageHint')}</p>
      <button type="submit" className="intro-btn primary" disabled={sending}>
        {sending ? t('contactSending') : t('contactSubmit')}
      </button>
      {error ? (
        <p className="contact-error" role="alert">
          {error}
        </p>
      ) : null}
      <output className="contact-status" aria-live="polite">
        {sent ? <span className="contact-success">{t('contactSuccess')}</span> : null}
      </output>
    </form>
  );
}

export default ContactForm;
