import { env } from 'cloudflare:workers';
import { compareSubjectFor, researchSubjectFor, subjectFor } from '#lib/server/identity.js';
import { peek, quotaInfo } from '#lib/server/quota.js';
import type { RequestHandler } from './$types';

/** Who the caller is and how many searches they have left. Works signed in or out. */
export const GET: RequestHandler = async ({ locals }) => {
	if (locals.authFailed) {
		return Response.json(
			{ error: 'Your sign-in has expired. Please sign in again.', code: 'auth_invalid' },
			{ status: 401 }
		);
	}

	const db = env.DB;
	if (!db) return Response.json({ error: 'Quota store is unavailable.' }, { status: 503 });

	const subject = subjectFor(locals);
	return Response.json({
		user: locals.user && { name: locals.user.name, email: locals.user.email },
		quota: quotaInfo(subject, await peek(db, subject)),
		research: quotaInfo(researchSubjectFor(locals), await peek(db, researchSubjectFor(locals))),
		compare: quotaInfo(compareSubjectFor(locals), await peek(db, compareSubjectFor(locals)))
	});
};
