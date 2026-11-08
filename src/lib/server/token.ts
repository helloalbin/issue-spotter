/**
 * A grant is what the server gives the browser after a search: permission to fetch a fixed list of
 * addresses and to ask once for the report. It names the visitor it was issued to and expires, and
 * it is signed with a key only the server holds, so it cannot be altered or lent.
 */
export type Grant = {
	kind: 'research' | 'compare' | 'verify';
	/** The quota subject it was issued to, so another visitor cannot use it. */
	who: string;
	/** The period the reserved unit was taken in, so a failure can give it back. */
	day: string;
	nonce: string;
	urls: string[];
	exp: number;
};

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (text: string) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function hmac(key: string, data: string): Promise<Uint8Array> {
	const cryptoKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data)));
}

/** A signature that is the same length whatever the input, compared without stopping at the first difference. */
function same(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
	return diff === 0;
}

export async function signGrant(grant: Grant, key: string): Promise<string> {
	const payload = b64(new TextEncoder().encode(JSON.stringify(grant)));
	return `${payload}.${b64(await hmac(key, `grant:${payload}`))}`;
}

/** The grant in a token, or null when it was not signed with this key, is malformed or has expired. */
export async function readGrant(token: string, key: string, now = Date.now()): Promise<Grant | null> {
	const [payload, signature, extra] = token.split('.');
	if (!payload || !signature || extra !== undefined) return null;
	try {
		if (!same(await hmac(key, `grant:${payload}`), unb64(signature))) return null;
		const grant = JSON.parse(new TextDecoder().decode(unb64(payload))) as Grant;
		if (typeof grant?.exp !== 'number' || grant.exp < now) return null;
		if (!Array.isArray(grant.urls) || typeof grant.who !== 'string' || typeof grant.nonce !== 'string') return null;
		return grant;
	} catch {
		return null;
	}
}

/** The stamp on a fetched file: its address, hash and time, signed. */
export async function signStamp(stamp: { url: string; sha256: string; fetchedAt: string }, key: string): Promise<string> {
	return b64(await hmac(key, `stamp:${stamp.url}|${stamp.sha256}|${stamp.fetchedAt}`));
}

export async function stampValid(stamp: { url: string; sha256: string; fetchedAt: string; sig: string }, key: string): Promise<boolean> {
	try {
		return same(unb64(stamp.sig), unb64(await signStamp(stamp, key)));
	} catch {
		return false;
	}
}
