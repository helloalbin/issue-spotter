import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** The token reference is a development aid and is never served in production. */
export const load: PageServerLoad = () => {
	if (import.meta.env.PROD) error(404, 'Not found');
};
