export const MIN_FACTS = 20;
export const MAX_FACTS = 12000;

export type ActReference = {
	act: string;
	sections: string[];
	relevance: string;
};

export type SpotterResult = {
	issues: string[];
	doctrines: string[];
	precedents: string[];
	acts: ActReference[];
};

/** Newline-delimited JSON events streamed by POST /api/spot. */
export type SpotEvent =
	| { stage: 'verifying' }
	| { stage: 'analyzing' }
	| { result: SpotterResult }
	| { notLegal: true }
	| { error: string };
