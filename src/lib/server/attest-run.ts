import { OPENAI_MODEL, PDF_ATTEST } from '$app/env/private';
import { ATTEST_INSTRUCTIONS, ATTEST_SCHEMA, applyAttestation, attestInput, parseAttest, passagesFrom } from './attest.ts';
import { post, readAnswer } from './openai.ts';
import type { Report } from '../spotter.ts';

/**
 * The independent check on quotes taken from a PDF read in the browser. A model reads the official
 * PDF itself, by address, so nothing the browser sent can steer it, and says whether each quote the
 * report kept is really there. It is a model's reading, so it is a second opinion, not a proof; it
 * costs a few cents and is skipped when no quote came from a PDF. A failure leaves the report as it was.
 */
export async function attestReport(fetchFn: typeof fetch, report: Report, pdfs: Map<number, string>, signal: AbortSignal): Promise<Report> {
	if (!PDF_ATTEST || pdfs.size === 0) return report;
	const passages = passagesFrom(report, new Set(pdfs.keys()));
	if (passages.length === 0) return report;

	const outcome = new Map<number, Map<number, boolean> | null>();
	for (const [source, url] of [...pdfs].slice(0, 2)) {
		const mine = passages.filter((passage) => passage.source === source);
		if (mine.length === 0) continue;
		try {
			const response = await post(
				fetchFn,
				'/responses',
				{
					model: OPENAI_MODEL,
					instructions: ATTEST_INSTRUCTIONS,
					input: [{ role: 'user', content: [{ type: 'input_file', file_url: url }, { type: 'input_text', text: attestInput(mine) }] }],
					text: { format: { type: 'json_schema', name: 'attestation', strict: true, schema: ATTEST_SCHEMA } },
					max_output_tokens: 200 + 30 * mine.length
				},
				signal
			);
			if (!response.ok) {
				console.error(`Checking quotes against the PDF failed (${response.status}):`, await response.text());
				outcome.set(source, null);
				continue;
			}
			const payload = await response.json();
			console.log(JSON.stringify({ event: 'llm_usage', call: 'attest', model: OPENAI_MODEL, promptTokens: payload?.usage?.input_tokens ?? null, completionTokens: payload?.usage?.output_tokens ?? null, quotes: mine.length }));
			const answers = parseAttest(readAnswer(payload).text);
			outcome.set(source, answers.size > 0 ? answers : null);
		} catch (error) {
			if (signal.aborted) throw error;
			console.error('Checking quotes against the PDF failed:', error);
			outcome.set(source, null);
		}
	}
	return applyAttestation(report, passages, outcome);
}
