import { templateFor } from './report.ts';
import type { Report, ResearchBrief, SpotterResult } from './spotter.ts';

/**
 * Turning a result into what is worth hearing, and the browser's speech engine into something that
 * copes with long, legal text. Everything here is pure, so it is tested without a browser.
 */

/** Speed presets. 1 is normal; most listeners stay between 0.75 and 1.5. */
export const RATES = [0.75, 1, 1.25, 1.5, 2] as const;

/**
 * Written legal shorthand, said the way it is read out. Each rule is a whole word, so "Section" in
 * "Section 19" is never touched twice, and a case name keeps its own punctuation.
 */
const SAYINGS: [RegExp, string][] = [
	[/\bu\/s\.?(?=\s)/gi, 'under section'],
	[/\bw\.e\.f\.?/gi, 'with effect from'],
	[/\bi\.e\.?,?/gi, 'that is,'],
	[/\be\.g\.?,?/gi, 'for example,'],
	[/\bHon['’]ble\b/g, 'Honourable'],
	[/\b(?:v|vs)\.?(?=\s+[A-Z“"(])/g, 'versus'],
	[/\bSecs\.?(?=\s*\d)/g, 'Sections'],
	[/\bSec\.?(?=\s*\d)/g, 'Section'],
	[/\bss\.(?=\s*\d)/g, 'Sections'],
	[/\bs\.(?=\s*\d)/g, 'Section'],
	[/\bArts\.?(?=\s*\d)/g, 'Articles'],
	[/\bArt\.?(?=\s*\d)/g, 'Article'],
	[/\bNos?\.(?=\s*\d)/g, 'Number'],
	[/\bOrs\./g, 'Others'],
	[/\bAnr\./g, 'Another'],
	[/§/g, 'section '],
	[/&/g, ' and ']
];

/** Text made ready to be spoken: markup and addresses removed, legal shorthand written out. */
export function forSpeech(input: string): string {
	let text = input
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/\[(\d+)\](?:\[(\d+)\])*/g, '')
		.replace(/\bhttps?:\/\/\S+/g, '')
		.replace(/[*_`#>]+/g, '');
	for (const [pattern, said] of SAYINGS) text = text.replace(pattern, said);
	return (
		text
			// "Section 19(1)(a)" is said "Section 19, sub-section 1, clause a".
			.replace(/(\d+[A-Z]?)\((\d+)\)\(([a-z])\)/g, '$1, sub-section $2, clause $3')
			.replace(/(\d+[A-Z]?)\((\d+)\)/g, '$1, sub-section $2')
			.replace(/\s+([,.;:!?])/g, '$1')
			.replace(/[ \t]+/g, ' ')
			.replace(/ *\n */g, '\n')
			.trim()
	);
}

/** A heading or a short label said as a sentence, so the voice pauses after it. */
const said = (text: string) => {
	const clean = forSpeech(text).replace(/[.:;,\s]+$/, '');
	return clean ? `${clean}.` : '';
};

const sentence = (text: string) => {
	const clean = forSpeech(text);
	return clean && !/[.!?]$/.test(clean) ? `${clean}.` : clean;
};

/** An analysis as spoken: its sections in the order they are shown, without the case facts or the disclaimer. */
export function analysisScript(result: SpotterResult): string {
	const out: string[] = [];
	const add = (heading: string, items: string[], numbered = false) => {
		const lines = items.map(sentence).filter(Boolean);
		if (lines.length === 0) return;
		out.push(said(heading), ...lines.map((line, at) => (numbered ? `${at + 1}. ${line}` : line)), '');
	};

	out.push(said(result.headline ?? 'Issue analysis'));
	if (result.jurisdiction) out.push(said(`Jurisdiction: ${result.jurisdiction}`));
	out.push('');
	add('What these facts change', result.update ?? []);
	add('Case summary', result.summary ?? []);
	add('Primary legal issues', result.issues, true);
	add('Relevant doctrines', result.doctrines);
	add('Landmark precedents', result.precedents.map((p) => `${p.name}${p.year ? `, ${p.year}` : ''}`));
	add(
		'Applicable acts and sections',
		result.acts.map((entry) => {
			const sections = entry.sections.length > 0 ? `, ${entry.sections.join(', ')}` : '';
			return `${entry.act}${sections}${entry.relevance ? `. ${entry.relevance}` : ''}`;
		})
	);
	add('Counter-arguments', (result.counterArguments ?? []).map((entry) => `${entry.issue}: ${entry.argument}`));
	add('What would sharpen this', result.openQuestions ?? []);
	return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** A drafted document as spoken. A [bracketed] gap is read as a blank to fill in. */
export function draftScript(result: SpotterResult): string {
	const blank = (text: string) => text.replace(/\[([^\]\n]+)\]/g, ', blank for $1,');
	const out = [said(result.documentTitle ?? result.documentType ?? 'Draft document'), ''];
	for (const block of result.draft ?? []) {
		if (block.heading) out.push(said(block.heading));
		out.push(...blank(block.text).split('\n').map(sentence).filter(Boolean), '');
	}
	const notes = (result.draftNotes ?? []).map(sentence).filter(Boolean);
	if (notes.length > 0) out.push(said('Notes before use'), ...notes);
	return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** What a mark on a checked line says, as the screen-reader text does. */
const MARKS = { ok: 'Checked.', warn: 'Worth a look.', fail: 'Not found.' } as const;

/**
 * A research report, comparison or citation check as spoken: its title, then each section of its
 * layout in order. Reasoning that no page confirms is said to be reasoning, so a listener can tell it
 * from what a source says.
 */
export function reportScript(report: Report): string {
	const slots = templateFor(report.kind);
	const out = [said(report.title), ''];

	for (const slot of slots) {
		const section = report.sections.find((entry) => entry.id === slot.id);
		const heading = said(slot.heading);
		const spoken: string[] = [];
		const line = (item: { text: string; basis: string; mark?: keyof typeof MARKS }) => {
			const prefix = item.mark ? `${MARKS[item.mark]} ` : item.basis === 'inference' ? 'Reasoning: ' : '';
			return `${prefix}${sentence(item.text)}`;
		};

		(section?.lines ?? []).forEach((item, at) => spoken.push(slot.numbered ? `Point ${at + 1}. ${line(item)}` : line(item)));
		for (const child of section?.children ?? []) {
			spoken.push(said(child.heading), ...child.lines.map(line));
		}
		spoken.push(...(section?.notes ?? []).map(sentence));

		const cleaned = spoken.filter(Boolean);
		if (cleaned.length > 0) out.push(heading, ...cleaned, '');
	}
	if (report.dropped > 0) {
		out.push(`${report.dropped} ${report.dropped === 1 ? 'statement was' : 'statements were'} left out because the cited page did not contain the passage given for ${report.dropped === 1 ? 'it' : 'them'}.`);
	}
	return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** The first search brief, which has no report layout: its headings and its sentences. */
export function briefScript(brief: ResearchBrief): string {
	const out = [said(brief.topic), ''];
	for (const block of brief.blocks) {
		if (block.kind === 'heading') out.push('', said(block.text));
		else out.push(...block.sentences.map((s) => (s.uncited ? `No source for this one: ${sentence(s.text)}` : sentence(s.text))));
	}
	return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * The script in pieces the speech engine copes with. A long utterance is cut off by some voices, so it
 * is spoken a sentence or two at a time, never past `max` characters, and a pause falls at each
 * paragraph break.
 */
export function chunkText(script: string, max = 200): string[] {
	const chunks: string[] = [];
	for (const paragraph of script.split(/\n+/).map((p) => p.trim()).filter(Boolean)) {
		let current = '';
		const flush = () => {
			if (current) chunks.push(current);
			current = '';
		};
		for (const sentence of paragraph.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)) {
			for (const piece of split(sentence, max)) {
				if (current && current.length + 1 + piece.length > max) flush();
				current = current ? `${current} ${piece}` : piece;
			}
		}
		flush();
	}
	return chunks;
}

/** One sentence in pieces no longer than `max`, at a comma, a semicolon or, failing that, a space. */
function split(text: string, max: number): string[] {
	if (text.length <= max) return [text];
	const out: string[] = [];
	let rest = text;
	while (rest.length > max) {
		const window = rest.slice(0, max);
		const at = Math.max(window.lastIndexOf(', '), window.lastIndexOf('; '), window.lastIndexOf(': '));
		const cut = at > max * 0.4 ? at + 1 : window.lastIndexOf(' ') > 0 ? window.lastIndexOf(' ') : max;
		out.push(rest.slice(0, cut).trim());
		rest = rest.slice(cut).trim();
	}
	if (rest) out.push(rest);
	return out;
}

export type VoiceInfo = { name: string; lang: string; localService: boolean; voiceURI: string };

/**
 * The voice to use. A saved choice wins. Otherwise an English voice, Indian English first, and one
 * that runs on the device before an online one, so the text does not leave the device.
 */
export function pickVoice<T extends VoiceInfo>(voices: T[], saved?: string): T | null {
	const chosen = saved ? voices.find((voice) => voice.voiceURI === saved) : undefined;
	if (chosen) return chosen;
	const score = (voice: T) => {
		const lang = voice.lang.replace('_', '-').toLowerCase();
		if (!lang.startsWith('en')) return -1;
		return (lang === 'en-in' ? 100 : lang === 'en-gb' ? 60 : lang === 'en-us' ? 40 : 20) + (voice.localService ? 30 : 0);
	};
	const best = [...voices].sort((a, b) => score(b) - score(a))[0];
	return best && score(best) >= 0 ? best : null;
}

export type SpeechPrefs = { rate: number; voice?: string };

/** Saved preferences, made safe: only a known rate and a short voice id are accepted. */
export function parsePrefs(raw: string | null): SpeechPrefs {
	try {
		const data = JSON.parse(raw ?? 'null');
		const rate = (RATES as readonly number[]).includes(data?.rate) ? data.rate : 1;
		const voice = typeof data?.voice === 'string' && data.voice.length < 200 ? data.voice : undefined;
		return { rate, ...(voice && { voice }) };
	} catch {
		return { rate: 1 };
	}
}
