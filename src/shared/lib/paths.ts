import { resolve } from '$app/paths';
import type { ResolvedPathname } from '$app/types';

/**
 * Resolve a pathname that is only known at runtime (redirect target, nav entry,
 * back link) through `$app/paths`.
 *
 * `resolve()` is typed against one route per call: its generic argument expands
 * to a union of single-route tuples, so a `Pathname` union — which is what a
 * runtime pathname is — is rejected by `svelte-check`
 * (`resolve(path as Pathname)` does not compile). This helper keeps the call to
 * `resolve()` so the base path is still applied, and widens only the parameter
 * type. Literal and template-literal call sites use `resolve()` directly and
 * never need it.
 */
const resolveRuntime = resolve as (path: string) => ResolvedPathname;

export function resolvePath(path: string): ResolvedPathname {
	return resolveRuntime(path);
}
