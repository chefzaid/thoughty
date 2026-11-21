import { useSearchParams } from 'react-router-dom';

import SimpleMemoirPage, { type SimpleMemoirPageProps } from '../components/SimpleMemoir/SimpleMemoirPage';

/** `/memoir/simple?question=<id>` (the weekly email link in simple mode) asks that question first. */
function SimpleMemoirRoute(props: Readonly<Omit<SimpleMemoirPageProps, 'questionId'>>) {
  const [searchParams] = useSearchParams();
  return <SimpleMemoirPage {...props} questionId={searchParams.get('question')} />;
}

export default SimpleMemoirRoute;
