import type { ComponentProps } from 'react';
import TagManagerPage from '../components/TagManagerPage/TagManagerPage';

type TagManagerRouteProps = ComponentProps<typeof TagManagerPage>;

function TagManagerRoute(props: Readonly<TagManagerRouteProps>) {
  return <TagManagerPage {...props} />;
}

export default TagManagerRoute;