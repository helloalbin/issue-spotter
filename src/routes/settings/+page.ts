import { redirect } from '@sveltejs/kit';

/** Settings has no page of its own: it opens on its first section. */
export function load() {
	redirect(307, '/settings/appearance');
}
