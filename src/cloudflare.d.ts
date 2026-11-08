// Bindings declared in wrangler.jsonc, available from `cloudflare:workers` in dev and on Workers.
declare module 'cloudflare:workers' {
	export const env: {
		DB?: import('@cloudflare/workers-types').D1Database;
		EMAIL?: { send(message: unknown): Promise<void> };
	};
}

declare module 'cloudflare:email' {
	export class EmailMessage {
		constructor(from: string, to: string, raw: string);
	}
}
