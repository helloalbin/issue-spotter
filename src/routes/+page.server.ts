import { env } from 'cloudflare:workers';
import { researchSubjectFor, subjectFor } from '#lib/server/identity.js';
import { peek, quotaInfo } from '#lib/server/quota.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const db = env.DB;
	if (!db) return { quota: null, research: null };

	const subject = subjectFor(locals);
	const research = researchSubjectFor(locals);
	return {
		quota: quotaInfo(subject, await peek(db, subject)),
		research: quotaInfo(research, await peek(db, research))
	};
};
