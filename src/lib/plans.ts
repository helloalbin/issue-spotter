export type PlanId = 'free' | 'investigative' | 'researcher';

export type Plan = {
	id: PlanId;
	name: string;
	tagline: string;
	blurb: string;
	/** Rupees a month, or null where there is no charge. Approximate: set from a week of test spend, not from billing. */
	price: number | null;
	features: string[];
};

/**
 * The plans shown in the upgrade dialog. The free figures are the real limits. The paid ones are
 * the intended limits and are not enforced yet (`tierOf` still returns "free"), so paid plans are
 * set up by hand through the Contact form until payments exist.
 */
export const PLANS: Plan[] = [
	{
		id: 'free',
		name: 'Free',
		tagline: 'Practice the basics',
		blurb: 'Enough to learn issue-spotting at your own pace.',
		price: null,
		features: ['20 searches a day', '3 deep research, 3 comparisons and 3 citation checks a month', 'Cited pages read in your browser', 'Read aloud, drafts and exports']
	},
	{
		id: 'investigative',
		name: 'Investigative',
		tagline: 'Spot deeper, faster',
		blurb: 'More room for coursework, moot prep and regular practice.',
		price: 399,
		features: ['Everything in Free', '50 searches a day', '15 deep research, 15 comparisons and 15 citation checks a month', 'A stronger model writes your reports']
	},
	{
		id: 'researcher',
		name: 'Researcher',
		tagline: 'For serious research',
		blurb: 'The most room, and the strongest model on every report.',
		price: 999,
		features: ['Everything in Investigative', '100 searches a day', '40 deep research, 40 comparisons and 40 citation checks a month', 'The strongest writer model for reports']
	}
];

/** "₹399" for a paid plan, "₹0" for the free one. */
export const priceLabel = (plan: Plan) => `₹${(plan.price ?? 0).toLocaleString('en-IN')}`;

export const PRICE_NOTE = 'Prices are approximate and may change before billing starts. Paid plans are set up by hand for now: write to us and we will reply with the details.';
