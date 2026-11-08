import { env } from 'cloudflare:workers';
import { compareSubjectFor, researchSubjectFor, subjectFor, verifySubjectFor } from '#lib/server/identity.js';
import { peek, quotaInfo } from '#lib/server/quota.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const db = env.DB;
	if (!db) return { quota: null, research: null, compare: null, verify: null };

	const subject = subjectFor(locals);
	const research = researchSubjectFor(locals);
	const compare = compareSubjectFor(locals);
	const verify = verifySubjectFor(locals);
	return {
		quota: quotaInfo(subject, await peek(db, subject)),
		research: quotaInfo(research, await peek(db, research)),
		compare: quotaInfo(compare, await peek(db, compare)),
		verify: quotaInfo(verify, await peek(db, verify))
	};
};
