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
