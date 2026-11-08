/** Label put in front of each later message, so the model reads it as part of the same case. */
export const FURTHER_FACTS = 'Further facts: ';

/** A follow-up can be short ("It was flour."), so it needs less than a first message does. */
export const MIN_FOLLOW_UP = 5;

/**
 * The text sent for analysis: the case so far, then what the user is adding. Nothing the user typed
 * is changed or dropped; later messages only get a label in front.
 */
export function caseText(turns: string[], added = ''): string {
	const parts = turns.map((turn, index) => (index === 0 ? turn : FURTHER_FACTS + turn));
	if (added) parts.push(turns.length === 0 ? added : FURTHER_FACTS + added);
	return parts.join('\n\n');
}
