// Route resolution for the route-literal check in check-architecture.mjs (docs/ARCHITECTURE.md).
// Takes the app dir as a parameter so scripts/routes.test.mjs can run it on a fixture tree.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROUTE_EXTS = ['.tsx', '.ts'];
const GROUP_DIR = /^\(.+\)$/;
// `_layout`, `+not-found`, `+html`…: files Expo Router treats specially, never a URL.
const NOT_A_ROUTE = /^[_+]/;

const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const isRouteFile = (dir, name) =>
  !NOT_A_ROUTE.test(name) && ROUTE_EXTS.some((ext) => existsSync(join(dir, name + ext)));
/** Route groups directly in `dir`: `(tabs)/` etc. add no URL segment, so look inside them. */
const groupsIn = (dir) =>
  isDir(dir) ? readdirSync(dir).filter((n) => GROUP_DIR.test(n) && isDir(join(dir, n))) : [];

/** True when `segments` resolve to a route file in `dir`, entering route groups at any level. */
function matchRoute(dir, segments) {
  const [head, ...rest] = segments;
  const direct =
    head === undefined
      ? isRouteFile(dir, 'index')
      : (rest.length === 0 && isRouteFile(dir, head)) ||
        (!NOT_A_ROUTE.test(head) && isDir(join(dir, head)) && matchRoute(join(dir, head), rest));
  return direct || groupsIn(dir).some((g) => matchRoute(join(dir, g), segments));
}

/** True when the URL `route` ('/', '/settings', '/(tabs)/settings', '/alarm/[id]') has a route file under `appDir`. */
export function routeExists(appDir, route) {
  return matchRoute(appDir, route.split('/').filter(Boolean));
}
