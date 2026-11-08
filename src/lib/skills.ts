import type { IconName } from '#lib/icons.js';

/** The skills that change the analysis today. The rest are drawn in the drawer but not built. */
export type ActiveSkill = 'summarize' | 'counter-arguments';

export type SkillId = ActiveSkill | 'draft' | 'deep-research' | 'compare-cases' | 'verify-cites';

export const SKILLS: { id: SkillId; label: string; icon: IconName; available: boolean }[] = [
	{ id: 'draft', label: 'Draft', icon: 'squarePen', available: false },
	{ id: 'deep-research', label: 'Deep research', icon: 'telescope', available: false },
	{ id: 'compare-cases', label: 'Compare cases', icon: 'gitCompare', available: false },
	{ id: 'counter-arguments', label: 'Counter-args', icon: 'swords', available: true },
	{ id: 'verify-cites', label: 'Verify cites', icon: 'badgeCheck', available: false },
	{ id: 'summarize', label: 'Summarize', icon: 'list', available: true }
];

const ACTIVE: readonly string[] = ['summarize', 'counter-arguments'];

export const isActiveSkill = (value: unknown): value is ActiveSkill =>
	typeof value === 'string' && ACTIVE.includes(value);

export const skillLabel = (id: SkillId) => SKILLS.find((skill) => skill.id === id)?.label ?? id;
