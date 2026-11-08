export type Sample = { label: string; facts: string };

export const SAMPLES: Sample[] = [
	{
		label: 'Landlord & tenant',
		facts:
			'A tenant slipped on a wet staircase in a rented apartment building after repeated written complaints to the landlord about the leak. The tenant suffered a fractured ankle and missed two months of work.'
	},
	{
		label: 'Negligence',
		facts:
			'A pedestrian was hit by a delivery van at a signal in Pune while the driver was texting. The van belonged to a courier company that had never checked the driver’s licence. The pedestrian broke a leg and could not work for three months.'
	},
	{
		label: 'Contract breach',
		facts:
			'A caterer agreed in writing to serve 400 guests at a wedding on a fixed date for ₹2,40,000 and took an advance of ₹80,000. Two days before the wedding the caterer cancelled for a better-paying client. The family hired another caterer at short notice for ₹3,10,000.'
	}
];
