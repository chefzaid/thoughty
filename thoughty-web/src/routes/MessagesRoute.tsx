import { useSearchParams } from 'react-router-dom';

import MessagesPage from '../components/Messages/MessagesPage';
import PageHeader from '../components/PageHeader/PageHeader';
import FeatureOffNote from '../components/FeatureFlags/FeatureOffNote';
import { useFeatureFlag } from '../components/FeatureFlags/featureFlags';
import type { TranslationFunction } from '../types';

interface MessagesRouteProps {
  readonly theme?: 'light' | 'dark';
  readonly language?: string;
  readonly t: TranslationFunction;
}

/** `?conversation=7`: the open conversation; anything but a positive whole number is ignored. */
function conversationParam(value: string | null): number | null {
  const id = Number(value);
  return value && Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * `/messages`: the conversations, and the one in `?conversation=` open beside them, so Back returns to the
 * previous one. While public sharing is switched off, the page says so instead of asking what the API refuses.
 */
function MessagesRoute(props: Readonly<MessagesRouteProps>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const publicSharing = useFeatureFlag('publicSharing');

  if (!publicSharing) {
    return (
      <section className={`messages-page ${props.theme ?? 'dark'}`}>
        <PageHeader title={props.t('messages')} theme={props.theme} />
        <FeatureOffNote message="featureOffPublicSharing" theme={props.theme} t={props.t} />
      </section>
    );
  }
  return (
    <MessagesPage
      {...props}
      conversationId={conversationParam(searchParams.get('conversation'))}
      onOpenConversation={(id) => setSearchParams(id === null ? {} : { conversation: String(id) })}
    />
  );
}

export default MessagesRoute;
