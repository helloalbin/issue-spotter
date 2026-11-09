import { error } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { createRemoteJWKSet } from 'jose';
import { QUOTA_SALT } from '$app/env/private';
import { FIREBASE_AUTH_EMULATOR_URL, FIREBASE_PROJECT_ID } from '$app/env/public';
import { isProxyPath, passOn } from '#lib/server/auth-proxy.js';
import { networkOf } from '#lib/server/network.js';
import {
	FIREBASE_JWKS_URL,
	verifyEmulatorToken,
	verifyFirebaseToken
} from '#lib/server/firebase-auth.js';

const ANON_COOKIE = 'anon_id';
const ONE_YEAR = 60 * 60 * 24 * 365;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const firebaseKeys = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));

async function authenticate(token: string) {
	if (!FIREBASE_PROJECT_ID) throw new Error('Firebase is not configured.');
	// The emulator's unsigned tokens are only ever accepted outside production builds.
	if (!import.meta.env.PROD && FIREBASE_AUTH_EMULATOR_URL) {
		return verifyEmulatorToken(token, FIREBASE_PROJECT_ID);
	}
	return verifyFirebaseToken(token, FIREBASE_PROJECT_ID, firebaseKeys);
}

function quotaSalt(): string {
	if (QUOTA_SALT) return QUOTA_SALT;
	if (import.meta.env.PROD) {
		console.error('QUOTA_SALT must be set in production.');
		error(500, 'Server is missing QUOTA_SALT configuration.');
	}
	return 'dev-salt';
}

/** Hashes the client's network (see `networkOf`), not the raw address. */
async function hashIp(ip: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(`${quotaSalt()}:${networkOf(ip)}`)
	);
	return [...new Uint8Array(digest)]
		.slice(0, 16)
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

/** Headers that cost nothing and close common findings: no content sniffing, a short referrer, no device permissions the app never uses, and HTTPS only once a site has been seen on it. */
function secure(response: Response, url: URL, frame: 'DENY' | 'SAMEORIGIN'): Response {
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('x-frame-options', frame);
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
	if (url.protocol === 'https:') response.headers.set('strict-transport-security', 'max-age=31536000');
	return response;
}

export const handle: Handle = async ({ event, resolve }) => {
	// Firebase's sign-in pages, served from this site's address (see `auth-proxy.ts`). They take no visitor or account.
	if (isProxyPath(event.url.pathname)) {
		const proxied = await passOn(event.request, FIREBASE_PROJECT_ID);
		// The sign-in frame is shown inside this site's own pages, so it may be framed by them.
		return secure(proxied ?? new Response('Not found', { status: 404 }), event.url, 'SAMEORIGIN');
	}

	let anonId = event.cookies.get(ANON_COOKIE);

	if (!anonId || !UUID.test(anonId)) {
		anonId = crypto.randomUUID();
		event.cookies.set(ANON_COOKIE, anonId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: event.url.protocol === 'https:',
			maxAge: ONE_YEAR
		});
	}

	event.locals.visitor = { anonId, ipHash: await hashIp(event.getClientAddress()) };

	event.locals.user = null;
	event.locals.authFailed = false;
	const authorization = event.request.headers.get('authorization');
	if (authorization?.startsWith('Bearer ')) {
		try {
			event.locals.user = await authenticate(authorization.slice('Bearer '.length));
		} catch {
			event.locals.authFailed = true;
		}
	}

	return secure(await resolve(event), event.url, 'DENY');
};
