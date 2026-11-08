import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

/**
 * What the pages may load. Everything is the site's own except Firebase sign-in (Google's scripts, the
 * sign-in frame and the token calls). SvelteKit adds a nonce to its own inline scripts. Styles allow
 * inline because Svelte sets style attributes. Not applied in development, where the dev server and
 * the Auth emulator need more. To trial a change without blocking anything, move `directives` to
 * `reportOnly` (the browser then only logs violations to its console).
 */
const csp: NonNullable<Parameters<typeof sveltekit>[0]>['csp'] = {
	mode: 'auto',
	directives: {
		'default-src': ['self'],
		'script-src': ['self', 'https://apis.google.com'],
		'style-src': ['self', 'unsafe-inline'],
		'img-src': ['self', 'data:', 'blob:', 'https://*.googleusercontent.com'],
		'font-src': ['self', 'data:'],
		'connect-src': ['self', 'https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com', 'https://www.googleapis.com', 'https://apis.google.com'],
		'frame-src': ['self', 'https://accounts.google.com', 'https://*.firebaseapp.com', 'https://*.web.app'],
		'worker-src': ['self', 'blob:'],
		'object-src': ['none'],
		'base-uri': ['self'],
		'form-action': ['self'],
		'frame-ancestors': ['none']
	}
};

export default defineConfig(({ command }) => ({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Deployed to Cloudflare Workers, see wrangler.jsonc.
			adapter: adapter(),

			csp: command === 'build' ? csp : undefined
		})
	]
}));
