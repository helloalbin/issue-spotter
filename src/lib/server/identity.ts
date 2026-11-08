import {
	ANON_DAILY_LIMIT,
	COMPARE_IDENTIFY_DAILY_LIMIT,
	COMPARE_IDENTIFY_IP_DAILY_LIMIT,
	COMPARE_IP_MONTHLY_LIMIT,
	COMPARE_MONTHLY_LIMIT,
	COMPARE_SIGNED_IN_IP_MONTHLY_LIMIT,
	COMPARE_SIGNED_IN_MONTHLY_LIMIT,
	DEEP_RESEARCH_WRITE_MODEL,
	DEEP_RESEARCH_WRITE_MODEL_INVESTIGATIVE,
	DEEP_RESEARCH_WRITE_MODEL_RESEARCHER,
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

export type Tier = 'free' | 'investigative' | 'researcher';

/** Everyone is on the free tier until tiers exist (build step 5). */
export function tierOf(_locals: App.Locals): Tier {
	return 'free';
}

/** The writer for a tier, each falling back to the one below it; undefined means the search model. */
export function writeModelFor(tier: Tier): string | undefined {
	if (tier === 'researcher') return DEEP_RESEARCH_WRITE_MODEL_RESEARCHER ?? DEEP_RESEARCH_WRITE_MODEL_INVESTIGATIVE ?? DEEP_RESEARCH_WRITE_MODEL;
	if (tier === 'investigative') return DEEP_RESEARCH_WRITE_MODEL_INVESTIGATIVE ?? DEEP_RESEARCH_WRITE_MODEL;
	return DEEP_RESEARCH_WRITE_MODEL;
}

/** The monthly counter for comparing two cases, which costs about what deep research does. */
export function compareSubjectFor(locals: App.Locals): Subject {
	const base = subjectFor(locals);
	return {
		...base,
		ns: `compare:${base.ns}`,
		period: 'month',
		limits: locals.user
			? { anon: COMPARE_SIGNED_IN_MONTHLY_LIMIT, ip: COMPARE_SIGNED_IN_IP_MONTHLY_LIMIT }
			: { anon: COMPARE_MONTHLY_LIMIT, ip: COMPARE_IP_MONTHLY_LIMIT }
	};
}

/** Finding the two cases is a search of its own, counted by the day apart from the comparison. */
export function identifySubjectFor(locals: App.Locals): Subject {
	const base = subjectFor(locals);
	return { ...base, ns: `cmpid:${base.ns}`, limits: { anon: COMPARE_IDENTIFY_DAILY_LIMIT, ip: COMPARE_IDENTIFY_IP_DAILY_LIMIT } };
}
