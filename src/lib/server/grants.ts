import type { D1Database } from '@cloudflare/workers-types';
import { QUOTA_SALT } from '$app/env/private';
import { signGrant } from './token.ts';
import type { Grant } from './token.ts';

/** The signing key: the same secret that salts hashed addresses, which production must set. */
export function signingKey(): string {
	if (QUOTA_SALT) return QUOTA_SALT;
	if (import.meta.env.PROD) throw new Error('QUOTA_SALT must be set in production.');
	return 'dev-salt';
}

export const GRANT_MINUTES = 15;

export async function issueGrant(kind: Grant['kind'], who: string, day: string, urls: string[]): Promise<string> {
	const grant: Grant = { kind, who, day, nonce: crypto.randomUUID(), urls, exp: Date.now() + GRANT_MINUTES * 60_000 };
	return signGrant(grant, signingKey());
}

/**
 * Uses a grant up: the report can be asked for once. A second request with the same token finds it
 * already taken. Stored with the quota counters under its own key.
 */
export async function consumeGrant(db: D1Database, grant: Grant): Promise<boolean> {
	const result = await db
		.prepare("INSERT OR IGNORE INTO quota_usage (key, day, count) VALUES (?, ?, 1)")
		.bind(`grant:${grant.nonce}`, grant.day)
		.run();
	return (result.meta?.changes ?? 0) > 0;
}
