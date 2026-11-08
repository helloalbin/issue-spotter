import type { SignedInUser } from '#lib/server/firebase-auth.js';
import type { Visitor } from '#lib/server/quota.js';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			visitor: Visitor;
			/** The verified Firebase user, or null when the request carries no valid token. */
			user: SignedInUser | null;
			/** True when a bearer token was sent but could not be verified. */
			authFailed: boolean;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
