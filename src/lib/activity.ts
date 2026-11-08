/**
 * What a person has done in the app, kept in their browser and nowhere else. It is a small tally, not
 * a log: counts per day, a few totals and a few "most used" maps. Everything on the profile page is
 * worked out from it. It is pure, so it can be tested without a browser.
 */

export type RunKind = 'analysis' | 'draft' | 'research' | 'compare' | 'verify';

/** One day's tally: runs and issues, and (since the analytics tab) which kinds of run and which skills. */
export type DayCount = {
	runs: number;
	issues: number;
	/** How many runs of each kind. Days recorded before this was kept do not have it. */
	kinds?: Partial<Record<RunKind, number>>;
	skills?: Record<string, number>;
};

export type Activity = {
	version: 1;
	/** Runs and issues spotted per local calendar day, "YYYY-MM-DD". */
	days: Record<string, DayCount>;
	/** The longest single run, in milliseconds. */
	longestMs: number;
	/** How many times each skill was used. */
	skills: Record<string, number>;
	acts: Record<string, number>;
	jurisdictions: Record<string, number>;
	/** Pages read, by site. */
	sites: Record<string, number>;
	/** Citations the person had checked. */
	citations: number;
};

/** One finished run. Every completed result counts, whatever the kind. */
export type Run = {
	at: number;
	kind: RunKind;
	ms?: number;
	issues?: number;
	skills?: string[];
	acts?: string[];
	jurisdiction?: string;
	hosts?: string[];
	citations?: number;
};

const MAX_KEYS = 200;
export const emptyActivity = (): Activity => ({ version: 1, days: {}, longestMs: 0, skills: {}, acts: {}, jurisdictions: {}, sites: {}, citations: 0 });

const pad = (n: number) => String(n).padStart(2, '0');

/** The local calendar day of a moment, so a run at 11:50 pm belongs to that evening. */
export function dayKey(at: number): string {
	const d = new Date(at);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A number for a day that moves by one each day whatever the clocks do. */
export function dayIndex(key: string): number {
	const [y, m, d] = key.split('-').map(Number);
	return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export const keyOfIndex = (index: number) => {
	const d = new Date(index * 86_400_000);
	return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

/** The few sites worth naming, from the address a page was read at. */
export function siteOf(host: string): string | null {
	const h = host.toLowerCase().replace(/^www\./, '');
	if (h.endsWith('indiankanoon.org')) return 'Indian Kanoon';
	if (h.endsWith('sci.gov.in') || h.endsWith('sci.in')) return 'Supreme Court of India';
	if (h.endsWith('indiacode.nic.in') || h.endsWith('indiacode.gov.in')) return 'India Code';
	if (/highcourt|hcmadras|mhc\.tn|mphc|hckerala|karnatakajudiciary/.test(h)) return 'High Courts';
	return null;
}

const bump = (map: Record<string, number>, key: string, by = 1) => ({ ...map, [key]: (map[key] ?? 0) + by });

/** A map kept to its most used entries, so it cannot grow without bound. */
function pruned(map: Record<string, number>): Record<string, number> {
	const entries = Object.entries(map);
	if (entries.length <= MAX_KEYS) return map;
	return Object.fromEntries(entries.sort((a, b) => b[1] - a[1]).slice(0, MAX_KEYS));
}

/** The tally with one more run in it. The input is not changed. */
export function recordRun(activity: Activity, run: Run): Activity {
	const key = dayKey(run.at);
	const day: DayCount = activity.days[key] ?? { runs: 0, issues: 0 };
	const skills = { ...day.skills };
	for (const skill of new Set(run.skills ?? [])) skills[skill] = (skills[skill] ?? 0) + 1;
	let next: Activity = {
		...activity,
		days: {
			...activity.days,
			[key]: {
				runs: day.runs + 1,
				issues: day.issues + Math.max(0, run.issues ?? 0),
				kinds: { ...day.kinds, [run.kind]: (day.kinds?.[run.kind] ?? 0) + 1 },
				...(Object.keys(skills).length > 0 && { skills })
			}
		},
		longestMs: Math.max(activity.longestMs, Math.max(0, run.ms ?? 0)),
		citations: activity.citations + Math.max(0, run.citations ?? 0)
	};
	for (const skill of new Set(run.skills ?? [])) next = { ...next, skills: bump(next.skills, skill) };
	for (const act of new Set((run.acts ?? []).map((name) => name.trim()).filter(Boolean))) next = { ...next, acts: pruned(bump(next.acts, act.slice(0, 120))) };
	if (run.jurisdiction?.trim()) next = { ...next, jurisdictions: pruned(bump(next.jurisdictions, run.jurisdiction.trim().slice(0, 80))) };
	for (const host of run.hosts ?? []) {
		const site = siteOf(host);
		if (site) next = { ...next, sites: bump(next.sites, site) };
	}
	return next;
}

/**
 * The longest run of days in a row with activity, and the run that is still going. A run is still
 * going if today or yesterday had activity: someone who has not yet used the app today has not lost
 * their streak.
 */
export function streaks(days: Activity['days'], now: number): { longest: number; current: number } {
	const active = [...new Set(Object.entries(days).filter(([, d]) => d.runs > 0).map(([key]) => dayIndex(key)))].sort((a, b) => a - b);
	let longest = 0;
	let run = 0;
	for (let i = 0; i < active.length; i++) {
		run = i > 0 && active[i] === active[i - 1] + 1 ? run + 1 : 1;
		longest = Math.max(longest, run);
	}
	const today = dayIndex(dayKey(now));
	const set = new Set(active);
	let at = set.has(today) ? today : set.has(today - 1) ? today - 1 : null;
	let current = 0;
	while (at !== null && set.has(at)) {
		current += 1;
		at -= 1;
	}
	return { longest, current };
}

export type Totals = { analyses: number; issues: number; longestMs: number; longestStreak: number; currentStreak: number; skillsUsed: number; citations: number };

export function totalsOf(activity: Activity, now: number): Totals {
	const days = Object.values(activity.days);
	const { longest, current } = streaks(activity.days, now);
	return {
		analyses: days.reduce((sum, d) => sum + d.runs, 0),
		issues: days.reduce((sum, d) => sum + d.issues, 0),
		longestMs: activity.longestMs,
		longestStreak: longest,
		currentStreak: current,
		skillsUsed: Object.values(activity.skills).filter((n) => n > 0).length,
		citations: activity.citations
	};
}

/** "19m 35s", "45s", "1h 2m": a run time for people. */
export function formatDuration(ms: number): string {
	if (!ms || ms < 1000) return ms > 0 ? '<1s' : '—';
	const total = Math.round(ms / 1000);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	if (h > 0) return `${h}h ${m}m`;
	return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** The most used entry and its share of all uses, or null when there are none. */
export function topShare(map: Record<string, number>): { name: string; pct: number } | null {
	const entries = Object.entries(map).filter(([, n]) => n > 0);
	if (entries.length === 0) return null;
	const total = entries.reduce((sum, [, n]) => sum + n, 0);
	const [name, count] = entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
	return { name, pct: Math.round((count / total) * 100) };
}

export type Cell = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4; future: boolean };

/** 0 for a quiet day, 1 to 4 by how it compares with the busiest day in view. */
export function levelOf(count: number, max: number): Cell['level'] {
	if (count <= 0 || max <= 0) return 0;
	return Math.max(1, Math.min(4, Math.ceil((count / max) * 4))) as Cell['level'];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sep 20, 2026". */
const longDate = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${Number(key.slice(8))}, ${key.slice(0, 4)}`;

/**
 * The twelve months ending with this one, laid out as weeks that start on a Sunday: from the week
 * holding the 1st of the month eleven months back (in November, December) to the week holding today.
 * Each month is labelled over the week that holds its 1st.
 */
export function yearWindow(now: number): { start: number; weeks: number; today: number; months: { label: string; column: number }[] } {
	const date = new Date(now);
	const first = new Date(date.getFullYear(), date.getMonth() - 11, 1);
	const start = dayIndex(dayKey(first.getTime())) - first.getDay();
	const today = dayIndex(dayKey(now));
	const weeks = (today - date.getDay() - start) / 7 + 1;
	const months = Array.from({ length: 12 }, (_, i) => {
		const m = new Date(first.getFullYear(), first.getMonth() + i, 1);
		return { label: MONTHS[m.getMonth()], column: Math.floor((dayIndex(dayKey(m.getTime())) - start) / 7) };
	});
	return { start, weeks, today, months };
}

/** The twelve months as columns of weeks (Sunday to Saturday), the last column holding today. */
export function heatmap(activity: Activity, now: number): { columns: Cell[][]; months: { label: string; column: number }[]; max: number; total: number } {
	const { start, weeks, today, months } = yearWindow(now);
	let max = 0;
	let total = 0;
	for (let i = start; i <= today; i++) {
		const count = activity.days[keyOfIndex(i)]?.runs ?? 0;
		max = Math.max(max, count);
		total += count;
	}

	const columns: Cell[][] = [];
	for (let w = 0; w < weeks; w++) {
		const column: Cell[] = [];
		for (let d = 0; d < 7; d++) {
			const index = start + w * 7 + d;
			const future = index > today;
			const count = future ? 0 : (activity.days[keyOfIndex(index)]?.runs ?? 0);
			column.push({ date: keyOfIndex(index), count, level: levelOf(count, max), future });
		}
		columns.push(column);
	}
	return { columns, months, max, total };
}

export type Bar = {
	/** "Week of Sep 20, 2026". */
	label: string;
	/** "Through week of Sep 20, 2026". */
	through: string;
	count: number;
	/** Everything up to the end of this week, including what came before the twelve months. */
	total: number;
};

/** One bar per week of the same twelve months: runs that week, and the running total. */
export function weekly(activity: Activity, now: number): { bars: Bar[]; months: { label: string; column: number }[] } {
	const { start, weeks, months } = yearWindow(now);
	let running = 0;
	for (const [key, day] of Object.entries(activity.days)) if (dayIndex(key) < start) running += day.runs;
	const bars: Bar[] = [];
	for (let w = 0; w < weeks; w++) {
		let count = 0;
		for (let d = 0; d < 7; d++) count += activity.days[keyOfIndex(start + w * 7 + d)]?.runs ?? 0;
		running += count;
		const first = longDate(keyOfIndex(start + w * 7));
		bars.push({ label: `Week of ${first}`, through: `Through week of ${first}`, count, total: running });
	}
	return { bars, months };
}

export type RecentDay = { date: string; label: string; count: number };

/** The last `days` days, oldest first, with how many runs each held and the total. */
export function recentDays(activity: Activity, now: number, days = 30): { days: RecentDay[]; total: number } {
	const today = dayIndex(dayKey(now));
	const out: RecentDay[] = [];
	let total = 0;
	for (let i = today - days + 1; i <= today; i++) {
		const date = keyOfIndex(i);
		const count = activity.days[date]?.runs ?? 0;
		total += count;
		out.push({ date, label: longDate(date), count });
	}
	return { days: out, total };
}

/** What is read back from storage, made safe: anything that is not the right shape is dropped. */
export function parseActivity(raw: string | null): Activity {
	if (!raw) return emptyActivity();
	try {
		const data = JSON.parse(raw);
		if (data?.version !== 1 || typeof data.days !== 'object' || data.days === null) return emptyActivity();
		const counts = (value: unknown): Record<string, number> =>
			Object.fromEntries(Object.entries(value && typeof value === 'object' ? value : {}).filter(([, n]) => Number.isFinite(n) && (n as number) >= 0).slice(0, MAX_KEYS)) as Record<string, number>;
		const days: Activity['days'] = {};
		const KINDS: RunKind[] = ['analysis', 'draft', 'research', 'compare', 'verify'];
		for (const [key, d] of Object.entries(data.days as Record<string, any>)) {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isFinite(d?.runs) || d.runs < 0) continue;
			const day: DayCount = { runs: d.runs, issues: Number.isFinite(d?.issues) && d.issues >= 0 ? d.issues : 0 };
			const kinds = Object.fromEntries(KINDS.filter((kind) => Number.isFinite(d?.kinds?.[kind]) && d.kinds[kind] > 0).map((kind) => [kind, d.kinds[kind]]));
			if (Object.keys(kinds).length > 0) day.kinds = kinds;
			const skills = Object.fromEntries(Object.entries(d?.skills && typeof d.skills === 'object' ? d.skills : {}).filter(([name, n]) => name.length < 40 && Number.isFinite(n) && (n as number) > 0).slice(0, 12));
			if (Object.keys(skills).length > 0) day.skills = skills as Record<string, number>;
			days[key] = day;
		}
		return {
			version: 1,
			days,
			longestMs: Number.isFinite(data.longestMs) && data.longestMs > 0 ? data.longestMs : 0,
			skills: counts(data.skills),
			acts: counts(data.acts),
			jurisdictions: counts(data.jurisdictions),
			sites: counts(data.sites),
			citations: Number.isFinite(data.citations) && data.citations > 0 ? data.citations : 0
		};
	} catch {
		return emptyActivity();
	}
}

/** The kinds of run, in the order they are listed, with how each is named. */
export const FEATURES: { kind: RunKind; label: string; nouns: [string, string] }[] = [
	{ kind: 'analysis', label: 'Analyses', nouns: ['analysis', 'analyses'] },
	{ kind: 'draft', label: 'Drafts', nouns: ['draft', 'drafts'] },
	{ kind: 'research', label: 'Deep research', nouns: ['report', 'reports'] },
	{ kind: 'compare', label: 'Case comparisons', nouns: ['comparison', 'comparisons'] },
	{ kind: 'verify', label: 'Citation checks', nouns: ['check', 'checks'] }
];

export type FeatureRow = { kind: RunKind; label: string; nouns: [string, string]; total: number; share: number; counts: number[] };

/**
 * How many runs of each kind there were on each of the last `days` days. `unsplit` is runs recorded
 * before kinds were kept, which belong to no feature. Shares are of the runs that are split.
 */
export function featureHistory(activity: Activity, now: number, days: number): { rows: FeatureRow[]; dates: string[]; labels: string[]; unsplit: number; tallest: number } {
	const today = dayIndex(dayKey(now));
	const dates: string[] = [];
	for (let i = today - days + 1; i <= today; i++) dates.push(keyOfIndex(i));

	let unsplit = 0;
	const rows = FEATURES.map((feature) => ({ ...feature, total: 0, share: 0, counts: [] as number[] }));
	for (const date of dates) {
		const day = activity.days[date];
		let split = 0;
		for (const row of rows) {
			const n = day?.kinds?.[row.kind] ?? 0;
			row.counts.push(n);
			row.total += n;
			split += n;
		}
		unsplit += Math.max(0, (day?.runs ?? 0) - split);
	}
	const all = rows.reduce((sum, row) => sum + row.total, 0);
	for (const row of rows) row.share = all > 0 ? Math.round((row.total / all) * 100) : 0;
	return { rows, dates, labels: dates.map(longDate), unsplit, tallest: Math.max(1, ...rows.flatMap((row) => row.counts)) };
}

/** How often each skill was used over the last `days` days, most used first; skills never used are left out. */
export function skillHistory(activity: Activity, now: number, days: number): { id: string; total: number }[] {
	const today = dayIndex(dayKey(now));
	const totals: Record<string, number> = {};
	for (let i = today - days + 1; i <= today; i++) {
		for (const [id, n] of Object.entries(activity.days[keyOfIndex(i)]?.skills ?? {})) totals[id] = (totals[id] ?? 0) + n;
	}
	return Object.entries(totals).map(([id, total]) => ({ id, total })).filter((entry) => entry.total > 0).sort((a, b) => b.total - a.total || a.id.localeCompare(b.id));
}

/** The acts that came up most, with their share of all the acts that came up. */
export function topActs(activity: Activity, limit = 5): { name: string; count: number; pct: number }[] {
	const entries = Object.entries(activity.acts).filter(([, n]) => n > 0);
	const total = entries.reduce((sum, [, n]) => sum + n, 0);
	return entries
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, limit)
		.map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100) }));
}
