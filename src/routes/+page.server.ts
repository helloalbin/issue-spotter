import { env } from 'cloudflare:workers';
import { ANON_DAILY_LIMIT, ANON_IP_DAILY_LIMIT } from '$app/env/private';
import { peek, quotaInfo } from '#lib/server/quota.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const db = env.DB;
	if (!db) return { quota: null };

	const remaining = await peek(db, 'search', locals.visitor, {
		anon: ANON_DAILY_LIMIT,
		ip: ANON_IP_DAILY_LIMIT
	});
	return { quota: quotaInfo(ANON_DAILY_LIMIT, remaining) };
};
