import type { D1Database } from '@cloudflare/workers-types';
import type { QuotaInfo } from '#lib/spotter.js';

export type Visitor = { anonId: string; ipHash: string };
export type QuotaLimits = { anon: number; ip: number };

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

function keysFor(ns: string, visitor: Visitor) {
	return { anon: `${ns}:a:${visitor.anonId}`, ip: `${ns}:i:${visitor.ipHash}` };
}

export function quotaInfo(limit: number, remaining: number): QuotaInfo {
	return { limit, remaining: Math.max(remaining, 0), resetsAt: nextReset() };
}

/** Takes one unit from both the per-browser and the per-IP counter, or neither. */
export async function reserve(
	db: D1Database,
	ns: string,
	visitor: Visitor,
	limits: QuotaLimits
): Promise<Reservation> {
	const day = currentDay();
	const keys = keysFor(ns, visitor);
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
export async function release(
	db: D1Database,
	ns: string,
	visitor: Visitor,
	day: string
): Promise<void> {
	const keys = keysFor(ns, visitor);
	await db.batch([
		db.prepare(RELEASE).bind(keys.anon, day),
		db.prepare(RELEASE).bind(keys.ip, day)
	]);
}

/** Remaining units without taking any. */
export async function peek(
	db: D1Database,
	ns: string,
	visitor: Visitor,
	limits: QuotaLimits
): Promise<number> {
	const day = currentDay();
	const keys = keysFor(ns, visitor);
	const [anon, ip] = await db.batch<{ count: number }>([
		db.prepare(PEEK).bind(keys.anon, day),
		db.prepare(PEEK).bind(keys.ip, day)
	]);
	return Math.max(
		Math.min(limits.anon - (anon.results[0]?.count ?? 0), limits.ip - (ip.results[0]?.count ?? 0)),
		0
	);
}
