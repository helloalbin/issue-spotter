/** The colour mode a person chooses. "System" follows the device and changes with it. */
export type Mode = 'light' | 'dark' | 'system';

export const MODES: readonly Mode[] = ['light', 'system', 'dark'];

/** A saved mode, made safe. Nothing saved, or anything unknown, means follow the system. */
export function parseMode(raw: string | null | undefined): Mode {
	return raw === 'light' || raw === 'dark' ? raw : 'system';
}

/** The theme that is actually shown for a mode. */
export function resolveMode(mode: Mode, prefersLight: boolean): 'light' | 'dark' {
	return mode === 'system' ? (prefersLight ? 'light' : 'dark') : mode;
}
