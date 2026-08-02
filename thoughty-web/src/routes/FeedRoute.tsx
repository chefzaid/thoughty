import FeedPage from '../components/FeedPage/FeedPage';

interface FeedRouteProps {
  readonly theme?: 'light' | 'dark';
  readonly t: (key: string, params?: Record<string, string | number>) => string;
}

function FeedRoute(props: Readonly<FeedRouteProps>) {
  return <FeedPage {...props} />;
}

export default FeedRoute;
