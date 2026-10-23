import type { ComponentProps } from 'react';
import { useNavigate } from 'react-router-dom';

import JournalView from '../components/JournalView/JournalView';
import { getPathForView } from '../types';

type JournalRouteProps = Omit<ComponentProps<typeof JournalView>, 'onOpenRecycleBin'>;

function JournalRoute(props: Readonly<JournalRouteProps>) {
  const navigate = useNavigate();

  return <JournalView {...props} onOpenRecycleBin={() => navigate(getPathForView('recycleBin'))} />;
}

export default JournalRoute;
