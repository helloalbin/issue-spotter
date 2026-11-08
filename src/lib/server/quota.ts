import type { D1Database } from '@cloudflare/workers-types';
import type { QuotaInfo } from '#lib/spotter.js';

export type Visitor = { anonId: string; ipHash: string };
export type QuotaLimits = { anon: number; ip: number };

/**
 * Who a quota is counted for. `id` is an anonymous cookie id or a Firebase uid, and `ns` keeps
 * the two apart. `limits.anon` applies to `id` and `limits.ip` to the hashed IP.
 */
export type Subject = {
	ns: string;
	id: string;
	ipHash: string;
	limits: QuotaLimits;
	/** Counted per calendar month (UTC) instead of per day. */
	period?: 'month';
};

export type Reservation =
	| { ok: true; remaining: number; day: string }
	| { ok: false; scope: 'anon' | 'ip' };

const DAY_MS = 86_400_000;

// Counts only increment while below the limit, so concurrent requests cannot overshoot it.
const RESERVE = `INSERT INTO quota_usage (key, day, count) VALUES (?1, ?2, 1)
	ON CONFLICT (key, day) DO UPDATE SET count = count + 1 WHERE count < ?3
	RETURNING count`;
const RELEASE = 'UPDATE quota_usage SET count = MAX(count - 1, 0) WHERE key = ?1 AND day = ?2';
const PEEK = 'SELECT count FROM quota_usage WHERE key = ?1 AND day = ?2';

/** Quota days run on UTC. */
export function currentDay(now = Date.now()): string {
	return new Date(now).toISOString().slice(0, 10);
}

export function nextReset(now = Date.now()): number {
	return (Math.floor(now / DAY_MS) + 1) * DAY_MS;
}

/** The key a counter is kept under: the day, or the month for a monthly limit ("2026-11"). */
export function currentPeriod(period: 'month' | undefined, now = Date.now()): string {
	return period === 'month' ? new Date(now).toISOString().slice(0, 7) : currentDay(now);
}

/** When the counter starts over: the next midnight, or the first of next month, UTC. */
export function periodEnd(period: 'month' | undefined, now = Date.now()): number {
	if (period !== 'month') return nextReset(now);
	const date = new Date(now);
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
}

function keysFor(subject: Subject) {
	return {
		anon: `${subject.ns}:a:${subject.id}`,
		ip: `${subject.ns}:i:${subject.ipHash}`
	};
}

export function quotaInfo(subject: Subject, remaining: number): QuotaInfo {
	return {
		signedIn: !subject.ns.endsWith('search'),
		limit: subject.limits.anon,
		remaining: Math.max(remaining, 0),
		resetsAt: periodEnd(subject.period)
	};
}

/** The counter for free non-legal rejections: a separate namespace with scaled-up limits. */
export function rejectionSubject(subject: Subject, multiplier: number): Subject {
	return {
		...subject,
		ns: `reject:${subject.ns}`,
		limits: { anon: subject.limits.anon * multiplier, ip: subject.limits.ip * multiplier }
	};
}

/** Takes one unit from both the per-browser and the per-IP counter, or neither. */
export async function reserve(db: D1Database, subject: Subject): Promise<Reservation> {
	const { limits } = subject;
	const day = currentPeriod(subject.period);
	const keys = keysFor(subject);
	const [anon, ip] = await db.batch<{ count: number }>([
		db.prepare(RESERVE).bind(keys.anon, day, limits.anon),
		db.prepare(RESERVE).bind(keys.ip, day, limits.ip)
	]);
	const anonCount = anon.results[0]?.count;
	const ipCount = ip.results[0]?.count;

	if (anonCount && ipCount) {
		return { ok: true, remaining: limits.anon - anonCount, day };
	}

	// One side was full; give back whatever the other side took.
	const undo = [];
	if (anonCount) undo.push(db.prepare(RELEASE).bind(keys.anon, day));
	if (ipCount) undo.push(db.prepare(RELEASE).bind(keys.ip, day));
	if (undo.length) await db.batch(undo);

	return { ok: false, scope: anonCount ? 'ip' : 'anon' };
}

/** Returns a unit taken by `reserve`, on the day it was taken. */
export async function release(db: D1Database, subject: Subject, day: string): Promise<void> {
	const keys = keysFor(subject);
	await db.batch([
		db.prepare(RELEASE).bind(keys.anon, day),
		db.prepare(RELEASE).bind(keys.ip, day)
	]);
}

/** Remaining units without taking any. */
export async function peek(db: D1Database, subject: Subject): Promise<number> {
	const { limits } = subject;
	const day = currentPeriod(subject.period);
	const keys = keysFor(subject);
	const [anon, ip] = await db.batch<{ count: number }>([
		db.prepare(PEEK).bind(keys.anon, day),
		db.prepare(PEEK).bind(keys.ip, day)
	]);
	return Math.max(
		Math.min(limits.anon - (anon.results[0]?.count ?? 0), limits.ip - (ip.results[0]?.count ?? 0)),
		0
	);
}
