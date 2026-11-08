import { env } from 'cloudflare:workers';
import { subjectFor } from '#lib/server/identity.js';
import { peek, quotaInfo } from '#lib/server/quota.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const db = env.DB;
	if (!db) return { quota: null };

	const subject = subjectFor(locals);
	return { quota: quotaInfo(subject, await peek(db, subject)) };
};
