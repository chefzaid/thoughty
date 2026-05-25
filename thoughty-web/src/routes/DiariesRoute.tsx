import type { ComponentProps } from 'react';
import DiaryManager from '../components/DiaryManager/DiaryManager';

type DiariesRouteProps = ComponentProps<typeof DiaryManager>;

function DiariesRoute(props: Readonly<DiariesRouteProps>) {
  return <DiaryManager {...props} />;
}

export default DiariesRoute;