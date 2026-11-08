import type { Visitor } from '#lib/server/quota.js';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			visitor: Visitor;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
