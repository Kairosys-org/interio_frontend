import { redirect } from '@sveltejs/kit';

/**
 * `/m` has no dashboard of its own: a surveyor's first job is the project
 * list. The redirect keeps a bare `/m` bookmark working.
 */
export function load(): never {
	redirect(307, '/m/projects');
}
