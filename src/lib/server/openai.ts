import { DEEP_RESEARCH_REASONING_EFFORT, DEEP_RESEARCH_WRITE_MAX_TOKENS, OPENAI_API_KEY, OPENAI_BASE_URL } from '$app/env/private';

/** One POST to the model provider. The caller decides what to do with a failure. */
export function post(fetchFn: typeof fetch, path: string, body: unknown, signal: AbortSignal): Promise<Response> {
	return fetchFn(`${OPENAI_BASE_URL}${path}`, {
		method: 'POST',
		signal,
		headers: {
			Authorization: ['Bearer', OPENAI_API_KEY].join(' '),
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	});
}

/** Reasoning models take a reasoning effort; the others reject the field. */
export const isReasoningModel = (model: string) => /^(gpt-5|o\d)/.test(model);

/** The request body for a writer that must answer in a schema. */
export function writerBody(model: string, instructions: string, content: unknown[], schemaName: string, schema: unknown) {
	return {
		model,
		instructions,
		input: [{ role: 'user', content }],
		text: { format: { type: 'json_schema', name: schemaName, strict: true, schema } },
		max_output_tokens: DEEP_RESEARCH_WRITE_MAX_TOKENS,
		...(isReasoningModel(model) && { reasoning: { effort: DEEP_RESEARCH_REASONING_EFFORT } })
	};
}

type Annotation = { type?: string; url?: string; title?: string };

/** The text of a Responses API answer, and the web pages it cited. */
export function readAnswer(payload: any): { text: string; urls: { url: string; title: string }[]; searches: number } {
	const output: any[] = Array.isArray(payload?.output) ? payload.output : [];
	const parts = output
		.filter((item) => item?.type === 'message')
		.flatMap((item) => (Array.isArray(item.content) ? item.content : []))
		.filter((part: any) => part?.type === 'output_text' && typeof part.text === 'string');
	const urls = parts
		.flatMap((part: any) => (Array.isArray(part.annotations) ? (part.annotations as Annotation[]) : []))
		.filter((annotation) => annotation.type === 'url_citation' && typeof annotation.url === 'string')
		.map((annotation) => ({ url: annotation.url!, title: annotation.title ?? '' }));
	return {
		text: parts.map((part: any) => part.text).join('\n'),
		urls,
		searches: output.filter((item) => item?.type === 'web_search_call').length
	};
}
