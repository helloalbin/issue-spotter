/**
 * What this browser holds for the person using it, and how to export or clear it. Pure, over a
 * storage-like object, so it is tested without a browser. Nothing here touches the server.
 */

type Reader = Pick<Storage, 'getItem'>;
type Remover = Pick<Storage, 'removeItem'>;

/** The storage keys the app writes, and why. The activity key has the person's identity after it. */
export const ACTIVITY_PREFIX = 'legalspotter:activity:';
export const PREFERENCE_KEYS = { theme: 'theme', pane: 'pane', speech: 'legalspotter:speech' } as const;

export type StorageItem = { name: string; where: 'Cookie' | 'Browser storage'; purpose: string; present: boolean | null; bytes: number | null };

/** The activity key for whoever is acting: their email when signed in, else one for a visitor. */
export const activityKey = (email: string | null | undefined) => `${ACTIVITY_PREFIX}${email ?? 'anonymous'}`;

const parse = (raw: string | null): unknown => {
	if (raw === null) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return raw;
	}
};

/**
 * Everything this browser holds for this person as a file: their activity numbers and their saved
 * preferences. Only the activity of whoever is acting now is included, not that of anyone else who
 * has used the same browser.
 */
export function exportData(storage: Reader, email: string | null | undefined, now: Date): { fileName: string; text: string } {
	const data = {
		app: 'Legal Spotter',
		exportedAt: now.toISOString(),
		about: 'Everything this browser holds for you. It was never sent to us.',
		signedInAs: email ?? null,
		activity: parse(storage.getItem(activityKey(email))),
		preferences: {
			theme: storage.getItem(PREFERENCE_KEYS.theme),
			verificationPane: storage.getItem(PREFERENCE_KEYS.pane),
			speech: parse(storage.getItem(PREFERENCE_KEYS.speech))
		}
	};
	// The date on the person's own clock, not UTC, so the file is named for the day they made it.
	const pad = (n: number) => String(n).padStart(2, '0');
	const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
	return { fileName: `legalspotter-data-${day}.json`, text: JSON.stringify(data, null, 2) + '\n' };
}

/** What the app keeps, whether it is there now and how big it is, for the "Cookies and storage" list. */
export function storageSummary(storage: Reader, email: string | null | undefined): StorageItem[] {
	const stored = (key: string) => {
		const value = storage.getItem(key);
		return { present: value !== null, bytes: value === null ? null : new Blob([value]).size };
	};
	const browser = (name: string, key: string, purpose: string): StorageItem => ({ name, where: 'Browser storage', purpose, ...stored(key) });
	return [
		{ name: 'anon_id', where: 'Cookie', purpose: 'A random ID that counts a visitor’s free searches. Needed for the daily limit; it lasts one year.', present: null, bytes: null },
		browser('theme', PREFERENCE_KEYS.theme, 'Your choice of light, dark or system.'),
		browser('pane', PREFERENCE_KEYS.pane, 'Whether the verification pane is open on wide screens.'),
		browser('legalspotter:speech', PREFERENCE_KEYS.speech, 'Your reading speed and voice for Read aloud.'),
		browser('legalspotter:activity', activityKey(email), 'Your activity numbers: analyses, streaks and the charts.')
	];
}

/** Forgets the saved preferences. The activity numbers are kept: they have their own reset. */
export function clearPreferences(storage: Remover): void {
	for (const key of Object.values(PREFERENCE_KEYS)) storage.removeItem(key);
}
