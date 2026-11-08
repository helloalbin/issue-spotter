// Bindings declared in wrangler.jsonc, available from `cloudflare:workers` in dev and on Workers.
declare module 'cloudflare:workers' {
	export const env: { DB?: import('@cloudflare/workers-types').D1Database };
}
