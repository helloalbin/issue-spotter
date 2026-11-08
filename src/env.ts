import { defineEnvVars } from '@sveltejs/kit/env';

function positiveInt(value: string | undefined, fallback: number): number {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const variables = defineEnvVars({
	OPENAI_API_KEY: {
		description: 'API key for the OpenAI-compatible chat completions provider.',
		schema: (value) => value
	},
	OPENAI_BASE_URL: {
		description: 'Base URL of the OpenAI-compatible chat completions API.',
		schema: (value) => value || 'https://api.openai.com/v1'
	},
	ANON_DAILY_LIMIT: {
		description: 'Searches per day for each anonymous browser.',
		schema: (value) => positiveInt(value, 5)
	},
	ANON_IP_DAILY_LIMIT: {
		description: 'Searches per day for each IP across all anonymous browsers (shared networks).',
		schema: (value) => positiveInt(value, 25)
	},
	SIGNED_IN_DAILY_LIMIT: {
		description: 'Searches per day for each signed-in account, until credits replace it.',
		schema: (value) => positiveInt(value, 20)
	},
	SIGNED_IN_IP_DAILY_LIMIT: {
		description: 'Searches per day per IP across all signed-in accounts.',
		schema: (value) => positiveInt(value, 200)
	},
	FIREBASE_API_KEY: {
		public: true,
		description: 'Firebase web API key. A public identifier, not a secret.',
		schema: (value) => value || undefined
	},
	FIREBASE_AUTH_DOMAIN: {
		public: true,
		description: 'Firebase auth domain, e.g. your-project.firebaseapp.com.',
		schema: (value) => value || undefined
	},
	FIREBASE_PROJECT_ID: {
		public: true,
		description: 'Firebase project id. The server checks it as the ID token audience.',
		schema: (value) => value || undefined
	},
	FIREBASE_APP_ID: {
		public: true,
		description: 'Firebase web app id.',
		schema: (value) => value || undefined
	},
	FIREBASE_AUTH_EMULATOR_URL: {
		public: true,
		description: 'Local Firebase Auth emulator URL. Development only; ignored in production builds.',
		schema: (value) => value || undefined
	},
	QUOTA_REJECTION_MULTIPLIER: {
		description: 'Non-legal rejections are free up to this multiple of the daily limits.',
		schema: (value) => positiveInt(value, 3)
	},
	QUOTA_SALT: {
		// Validated at request time (see hooks.server.ts): secrets are not present when Workers builds.
		description: 'Secret salt mixed into hashed IPs before they are stored. Required in production.',
		schema: (value) => value ?? ''
	},
	CLASSIFIER_MAX_TOKENS: {
		description: 'Output token cap for the legal-or-not classifier call.',
		schema: (value) => positiveInt(value, 8)
	},
	ANALYSIS_MAX_TOKENS: {
		description: 'Output token cap for the full analysis call.',
		schema: (value) => positiveInt(value, 2000)
	},
	CLASSIFIER_TIMEOUT_MS: {
		description: 'Longest the legal-or-not classifier may take. If it times out the analysis proceeds.',
		schema: (value) => positiveInt(value, 8000)
	},
	PROVIDER_IDLE_TIMEOUT_MS: {
		description: 'Longest the analysis call may go without a response or a new chunk before it is treated as stalled.',
		schema: (value) => positiveInt(value, 20000)
	},
	ANALYSIS_TOTAL_TIMEOUT_MS: {
		description: 'Longest the whole analysis call may take, even while it keeps streaming.',
		schema: (value) => positiveInt(value, 90000)
	},
	URL_FETCH_DAILY_LIMIT: {
		description: 'Pages one visitor or account may add as background per day. Failed fetches are not counted.',
		schema: (value) => positiveInt(value, 20)
	},
	URL_FETCH_IP_DAILY_LIMIT: {
		description: 'Pages one IP address may add per day, across visitors.',
		schema: (value) => positiveInt(value, 100)
	},
	DEEP_RESEARCH_MONTHLY_LIMIT: {
		description: 'Deep research runs per month for a visitor who is not signed in. Each run costs several cents.',
		schema: (value) => positiveInt(value, 1)
	},
	DEEP_RESEARCH_IP_MONTHLY_LIMIT: {
		description: 'Deep research runs per month for one IP address, across visitors who are not signed in.',
		schema: (value) => positiveInt(value, 5)
	},
	DEEP_RESEARCH_SIGNED_IN_MONTHLY_LIMIT: {
		description: 'Deep research runs per month for a signed-in account. Tiers will set their own.',
		schema: (value) => positiveInt(value, 3)
	},
	DEEP_RESEARCH_SIGNED_IN_IP_MONTHLY_LIMIT: {
		description: 'Deep research runs per month for one IP address, across signed-in accounts.',
		schema: (value) => positiveInt(value, 15)
	},
	DEEP_RESEARCH_MODEL: {
		description: 'Model for deep research. Defaults to OPENAI_MODEL; set a stronger one for better briefs.',
		schema: (value) => value || undefined
	},
	DEEP_RESEARCH_MAX_SEARCHES: {
		description: 'Most web searches one deep research run may make (sent as max_tool_calls). Each is billed.',
		schema: (value) => positiveInt(value, 12)
	},
	DEEP_RESEARCH_TIMEOUT_MS: {
		description: 'Longest a deep research run may take, searching and then reading the cited pages.',
		schema: (value) => positiveInt(value, 180000)
	},
	DEEP_RESEARCH_WRITE_MODEL: {
		description: 'Model that writes the research report from the pages. Defaults to DEEP_RESEARCH_MODEL. Any model works here: it does not search.',
		schema: (value) => value || undefined
	},
	DEEP_RESEARCH_WRITE_MODEL_INVESTIGATIVE: {
		description: 'Writer for the Investigative tier. Defaults to DEEP_RESEARCH_WRITE_MODEL.',
		schema: (value) => value || undefined
	},
	DEEP_RESEARCH_WRITE_MODEL_RESEARCHER: {
		description: 'Writer for the Researcher tier. Defaults to the Investigative writer.',
		schema: (value) => value || undefined
	},
	DEEP_RESEARCH_REASONING_EFFORT: {
		description: 'Reasoning effort sent to the writer when it is a reasoning model (gpt-5 family, o-series): minimal, low, medium or high.',
		schema: (value) => (['minimal', 'low', 'medium', 'high'].includes(value ?? '') ? (value as string) : 'low')
	},
	DEEP_RESEARCH_WRITE_MAX_TOKENS: {
		description: 'Most tokens the writer may produce, reasoning included.',
		schema: (value) => positiveInt(value, 8000)
	},
	DEEP_RESEARCH_PDF_MAX_BYTES: {
		description: 'Largest PDF handed to the writer. A bigger one is listed as opened but not read.',
		schema: (value) => positiveInt(value, 1500000)
	},
	DEEP_RESEARCH_READ_SOURCES: {
		description: 'Most cited pages a deep research run reads and writes its report from. 0 turns the report off and keeps the first brief.',
		schema: (value) => (value === '0' ? 0 : positiveInt(value, 4))
	},
	DEEP_RESEARCH_READ_CHARS: {
		description: 'Most characters of one cited page given to the writer. A longer judgment is cut down to its most relevant paragraphs, not at the end.',
		schema: (value) => positiveInt(value, 40000)
	},
	FILE_READ_DAILY_LIMIT: {
		description: 'Files one visitor or account may upload to be read per day. Unreadable or unrelated files are refunded.',
		schema: (value) => positiveInt(value, 10)
	},
	FILE_READ_IP_DAILY_LIMIT: {
		description: 'Files one IP address may upload to be read per day, across visitors.',
		schema: (value) => positiveInt(value, 50)
	},
	SOURCE_VERIFICATION: {
		description:
			'Verify cited references against real pages with a web search after the analysis: off, signed-in (signed-in users only) or all. Each verification costs about a cent.',
		schema: (value) => (value === 'all' || value === 'signed-in' ? value : 'off')
	},
	SOURCE_MODEL: {
		description: 'Model used for the reference web search. Defaults to OPENAI_MODEL.',
		schema: (value) => value || undefined
	},
	SOURCE_TIMEOUT_MS: {
		description: 'Longest the reference web search may take. On a timeout the search links stay.',
		schema: (value) => positiveInt(value, 30000)
	},
	SOURCE_MAX_SEARCHES: {
		description: 'Most web searches one verification may run. Each search is billed.',
		schema: (value) => positiveInt(value, 6)
	},
	OPENAI_MODEL: {
		description: 'Model name used for issue-spotting analysis.',
		schema: (value) => value || 'gpt-4o-mini'
	}
});
