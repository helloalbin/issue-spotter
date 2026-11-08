import {
	ANON_DAILY_LIMIT,
	DEEP_RESEARCH_IP_MONTHLY_LIMIT,
	DEEP_RESEARCH_MONTHLY_LIMIT,
	DEEP_RESEARCH_SIGNED_IN_IP_MONTHLY_LIMIT,
	DEEP_RESEARCH_SIGNED_IN_MONTHLY_LIMIT,
	ANON_IP_DAILY_LIMIT,
	SIGNED_IN_DAILY_LIMIT,
	SIGNED_IN_IP_DAILY_LIMIT
} from '$app/env/private';
import type { Subject } from './quota.js';

/** The quota subject for this request: the signed-in account if there is one, else the visitor. */
export function subjectFor(locals: App.Locals): Subject {
	if (locals.user) {
		return {
			ns: 'user',
			id: locals.user.uid,
			ipHash: locals.visitor.ipHash,
			limits: { anon: SIGNED_IN_DAILY_LIMIT, ip: SIGNED_IN_IP_DAILY_LIMIT }
		};
	}
	return {
		ns: 'search',
		id: locals.visitor.anonId,
		ipHash: locals.visitor.ipHash,
		limits: { anon: ANON_DAILY_LIMIT, ip: ANON_IP_DAILY_LIMIT }
	};
}

/**
 * The monthly counter for deep research, which costs far more than a search: a separate namespace
 * with its own, much smaller, limits.
 */
export function researchSubjectFor(locals: App.Locals): Subject {
	const base = subjectFor(locals);
	const signedIn = !!locals.user;
	return {
		...base,
		ns: `research:${base.ns}`,
		period: 'month',
		limits: signedIn
			? { anon: DEEP_RESEARCH_SIGNED_IN_MONTHLY_LIMIT, ip: DEEP_RESEARCH_SIGNED_IN_IP_MONTHLY_LIMIT }
			: { anon: DEEP_RESEARCH_MONTHLY_LIMIT, ip: DEEP_RESEARCH_IP_MONTHLY_LIMIT }
	};
}
