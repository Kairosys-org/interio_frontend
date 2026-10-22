import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/** `/platform` is not a screen of its own; the tenant list is the console home. */
export const load: PageLoad = () => {
	throw redirect(307, '/platform/tenants');
};
