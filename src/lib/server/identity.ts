import {
	ANON_DAILY_LIMIT,
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
