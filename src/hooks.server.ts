import { error } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { createRemoteJWKSet } from 'jose';
import { QUOTA_SALT } from '$app/env/private';
import { FIREBASE_AUTH_EMULATOR_URL, FIREBASE_PROJECT_ID } from '$app/env/public';
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

export const handle: Handle = async ({ event, resolve }) => {
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

	const response = await resolve(event);
	// Headers that cost nothing and close common findings: no content sniffing, no framing, a short
	// referrer, no device permissions the app never uses, and HTTPS only once a site has been seen on it.
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('x-frame-options', 'DENY');
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
	if (event.url.protocol === 'https:') response.headers.set('strict-transport-security', 'max-age=31536000');
	return response;
};
