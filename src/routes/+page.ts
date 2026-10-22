import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/** `/` is not a screen; it lands on the authenticated shell's home. */
export const load: PageLoad = () => {
	throw redirect(307, '/dashboard');
};
