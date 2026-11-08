import type { QuotaInfo } from './spotter.ts';

/** One limit on the Usage page: what it is, how much of it is left and when it comes back. */
export type LimitRow = {
	key: string;
	label: string;
	/** Said under the label, so it is clear what counts and for how long. */
	detail: string;
	limit: number;
	remaining: number;
	resetsAt: number;
};

/**
 * The limits a signed-in person has, in the order they are shown. A limit whose figure has not been
 * read yet is left out rather than shown as zero.
 */
export function limitRows(quotas: { searches: QuotaInfo | null; research: QuotaInfo | null; compare: QuotaInfo | null; verify: QuotaInfo | null }): LimitRow[] {
	const rows: [string, string, string, QuotaInfo | null][] = [
		['searches', 'Searches', 'Analyses, drafts and follow-ups, each day', quotas.searches],
		['research', 'Deep research', 'Cited research reports, each month', quotas.research],
		['compare', 'Case comparisons', 'Two cases compared, each month', quotas.compare],
		['verify', 'Citation checks', 'Cases checked against their judgments, each month', quotas.verify]
	];
	return rows.flatMap(([key, label, detail, quota]) =>
		quota ? [{ key, label, detail, limit: quota.limit, remaining: Math.max(0, Math.min(quota.remaining, quota.limit)), resetsAt: quota.resetsAt }] : []
	);
}

/** "Resets in 6h 12m" within a day, "Resets Dec 1" after that. */
export function describeReset(resetsAt: number, now: number): string {
	const ms = resetsAt - now;
	if (ms <= 0) return 'Resets now';
	const minutes = Math.ceil(ms / 60_000);
	if (minutes < 60) return `Resets in ${minutes}m`;
	if (minutes < 24 * 60) return `Resets in ${Math.floor(minutes / 60)}h ${minutes % 60}m`;
	return `Resets ${new Date(resetsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

/** How full a limit is, from 0 to 1: the share still left. */
export const leftShare = (row: Pick<LimitRow, 'limit' | 'remaining'>) => (row.limit > 0 ? row.remaining / row.limit : 0);
