import type { ComponentProps } from 'react';
import JournalView from '../components/JournalView/JournalView';

type JournalRouteProps = ComponentProps<typeof JournalView>;

function JournalRoute(props: Readonly<JournalRouteProps>) {
  return <JournalView {...props} />;
}

export default JournalRoute;