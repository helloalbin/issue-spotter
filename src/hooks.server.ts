import { error } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { QUOTA_SALT } from '$app/env/private';

const ANON_COOKIE = 'anon_id';
const ONE_YEAR = 60 * 60 * 24 * 365;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function quotaSalt(): string {
	if (QUOTA_SALT) return QUOTA_SALT;
	if (import.meta.env.PROD) {
		console.error('QUOTA_SALT must be set in production.');
		error(500, 'Server is missing QUOTA_SALT configuration.');
	}
	return 'dev-salt';
}

async function hashIp(ip: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(`${quotaSalt()}:${ip}`)
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

	return resolve(event);
};
