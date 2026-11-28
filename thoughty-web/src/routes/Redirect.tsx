import { Navigate, useLocation, useResolvedPath, type NavigateProps } from 'react-router-dom';

/**
 * `<Navigate>` that redirects from every location it is shown at, not only the first. React Router's
 * `<Navigate>` navigates from an effect that runs again only when its target changes, and location
 * updates are transitions that React can batch: when another navigation lands before the redirect's
 * own has been shown (the late `navigate('/')` of a sign-out, just after `/` asked for `/fr/`), the
 * page comes back to the address the redirect left, the same `<Navigate>` stays mounted, and it never
 * fires again, leaving an empty page. Keyed by the location, it starts again for each location; a
 * redirect to the address already shown does nothing, so it cannot go round in a loop.
 */
function Redirect(props: Readonly<NavigateProps>) {
  const location = useLocation();
  const target = useResolvedPath(props.to, { relative: props.relative });
  const alreadyThere = target.pathname === location.pathname
    && target.search === location.search
    && target.hash === location.hash;
  return alreadyThere ? null : <Navigate key={location.key} {...props} />;
}

export default Redirect;
