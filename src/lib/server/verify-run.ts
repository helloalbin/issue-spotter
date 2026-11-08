import { post, readAnswer, writerBody } from './openai.ts';
import { SUPPORT_INSTRUCTIONS, SUPPORT_SCHEMA, parseSupport, supportInput } from './verify-cites.ts';
import type { Item, Support } from './verify-cites.ts';

/**
 * Asks the model whether each judgment says what it is cited for. It is the only step of a citation
 * check that a model does. `checked` is false when the check could not run, so the report can say so
 * instead of reporting every point as unsupported.
 */
export async function checkSupport(
	fetchFn: typeof fetch,
	model: string,
	rows: { item: Item; n: number }[],
	sources: { n: number; title: string; host: string; text: string; cut: boolean }[],
	signal: AbortSignal
): Promise<{ support: Map<number, Support>; checked: boolean }> {
	const support = new Map<number, Support>();
	if (rows.length === 0) return { support, checked: true };
	try {
		const response = await post(fetchFn, '/responses', writerBody(model, SUPPORT_INSTRUCTIONS, [{ type: 'input_text', text: supportInput(rows, sources) }], 'citation_support', SUPPORT_SCHEMA), signal);
		if (!response.ok) {
			console.error(`Checking support failed (${response.status}):`, await response.text());
			return { support, checked: false };
		}
		const payload = await response.json();
		console.log(JSON.stringify({ event: 'llm_usage', call: 'verify_support', model, promptTokens: payload?.usage?.input_tokens ?? null, completionTokens: payload?.usage?.output_tokens ?? null, reasoningTokens: payload?.usage?.output_tokens_details?.reasoning_tokens ?? null, status: payload?.status ?? null, citations: rows.length }));
		for (const verdict of parseSupport(readAnswer(payload).text)) support.set(verdict.id, verdict);
		return { support, checked: support.size > 0 };
	} catch (error) {
		if (signal.aborted) throw error;
		console.error('Checking support failed:', error);
		return { support, checked: false };
	}
}
