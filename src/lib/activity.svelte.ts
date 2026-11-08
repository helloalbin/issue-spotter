import { emptyActivity, parseActivity, recordRun } from '#lib/activity.js';
import type { Activity, Run } from '#lib/activity.js';
import { auth } from '#lib/auth.svelte.js';

/**
 * The tally of whoever is using the app, read from and written to this browser's own storage. Each
 * signed-in person has their own, and a visitor who is not signed in has one more. Nothing is sent to
 * the server.
 */
class ActivityStore {
	data = $state<Activity>(emptyActivity());
	#key = '';

	/** Loads the tally of whoever is acting now, when that has changed. */
	sync() {
		const key = `legalspotter:activity:${auth.user?.email ?? 'anonymous'}`;
		if (key === this.#key) return;
		this.#key = key;
		try {
			this.data = parseActivity(localStorage.getItem(key));
		} catch {
			this.data = emptyActivity();
		}
	}

	record(run: Run) {
		this.sync();
		this.data = recordRun(this.data, run);
		try {
			localStorage.setItem(this.#key, JSON.stringify(this.data));
		} catch {
			// Storage can be full or blocked; the stats still count for this visit.
		}
	}

	reset() {
		this.sync();
		this.data = emptyActivity();
		try {
			localStorage.removeItem(this.#key);
		} catch {
			// Nothing was stored.
		}
	}
}

export const activityStore = new ActivityStore();
