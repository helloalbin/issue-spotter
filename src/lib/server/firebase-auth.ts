import { decodeJwt, jwtVerify, type JWTVerifyGetKey } from 'jose';

export type SignedInUser = { uid: string; email: string | null; name: string | null };

/** Google's public keys for Firebase ID tokens. */
export const FIREBASE_JWKS_URL =
	'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

function toUser(payload: { sub?: string; email?: unknown; name?: unknown }): SignedInUser {
	if (!payload.sub) throw new Error('Token has no subject.');
	return {
		uid: payload.sub,
		email: typeof payload.email === 'string' ? payload.email : null,
		name: typeof payload.name === 'string' ? payload.name : null
	};
}

/** Verifies a Firebase ID token: RS256 signature, issuer, audience and expiry. */
export async function verifyFirebaseToken(
	token: string,
	projectId: string,
	keys: JWTVerifyGetKey
): Promise<SignedInUser> {
	const { payload } = await jwtVerify(token, keys, {
		algorithms: ['RS256'],
		issuer: `https://securetoken.google.com/${projectId}`,
		audience: projectId
	});
	return toUser(payload);
}

/**
 * Accepts the unsigned tokens issued by the Firebase Auth emulator. Checks the same claims
 * as a real token but not the signature, so it must never be reachable in production.
 */
export function verifyEmulatorToken(token: string, projectId: string): SignedInUser {
	const payload = decodeJwt(token);
	if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Bad issuer.');
	if (payload.aud !== projectId) throw new Error('Bad audience.');
	if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) {
		throw new Error('Token expired.');
	}
	return toUser(payload);
}
