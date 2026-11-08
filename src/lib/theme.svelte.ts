import { parseMode, resolveMode } from '#lib/theme.js';
import type { Mode } from '#lib/theme.js';

const KEY = 'theme';

/**
 * The colour mode: light, dark, or the device's own, which changes with it. It is saved in this
 * browser and applied to <html> as `data-theme`; the page-load script in app.html does the same before
 * first paint so there is no flash.
 */
class Theme {
	mode = $state<Mode>('system');
	/** Whether the device prefers a light theme, which only matters in system mode. */
	prefersLight = $state(false);
	resolved = $derived(resolveMode(this.mode, this.prefersLight));

	/** Called once in the browser. */
	init() {
		try {
			this.mode = parseMode(localStorage.getItem(KEY));
		} catch {
			// No saved choice.
		}
		const query = matchMedia('(prefers-color-scheme: light)');
		this.prefersLight = query.matches;
		query.addEventListener('change', (event) => {
			this.prefersLight = event.matches;
			this.#apply();
		});
		this.#apply();
	}

	#apply() {
		document.documentElement.dataset.theme = this.resolved;
	}

	set(mode: Mode) {
		this.mode = mode;
		try {
			localStorage.setItem(KEY, mode);
		} catch {
			// The choice still applies for this visit.
		}
		this.#apply();
	}

	/** Back to following the device, and forget the saved choice. */
	reset() {
		this.mode = 'system';
		try {
			localStorage.removeItem(KEY);
		} catch {
			// Nothing was saved.
		}
		this.#apply();
	}

	/** The header toggle: the opposite of what is showing now. */
	toggle() {
		this.set(this.resolved === 'light' ? 'dark' : 'light');
	}
}

export const theme = new Theme();
