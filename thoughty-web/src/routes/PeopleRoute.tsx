import PeoplePage, { type PeoplePageProps } from '../components/People/PeoplePage';

/** `/people`: the people the writer mentions in entries. */
function PeopleRoute(props: Readonly<PeoplePageProps>) {
  return <PeoplePage {...props} />;
}

export default PeopleRoute;
