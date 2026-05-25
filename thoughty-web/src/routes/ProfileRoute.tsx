import type { ComponentProps } from 'react';
import ProfilePage from '../components/ProfilePage/ProfilePage';

type ProfileRouteProps = ComponentProps<typeof ProfilePage>;

function ProfileRoute(props: Readonly<ProfileRouteProps>) {
  return <ProfilePage {...props} />;
}

export default ProfileRoute;