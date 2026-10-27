import type { ComponentProps } from 'react';
import { useNavigate } from 'react-router-dom';

import JournalView from '../components/JournalView/JournalView';
import { getPathForView } from '../types';
import { LIFE_ERAS_SECTION_ID } from '../utils/lifeEras';

type JournalRouteProps = Omit<ComponentProps<typeof JournalView>, 'onOpenRecycleBin' | 'onManageLifeEras'>;

function JournalRoute(props: Readonly<JournalRouteProps>) {
  const navigate = useNavigate();

  return (
    <JournalView
      {...props}
      onOpenRecycleBin={() => navigate(getPathForView('recycleBin'))}
      onManageLifeEras={() => navigate({ pathname: getPathForView('profile'), hash: LIFE_ERAS_SECTION_ID })}
    />
  );
}

export default JournalRoute;
