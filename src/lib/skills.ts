import type { IconName } from '#lib/icons.js';

/**
 * The skills that change the analysis today. Deep research is a separate job with its own switch
 * (`workspace.researchMode`), and the rest are drawn in the drawer but not built.
 */
export type ActiveSkill = 'summarize' | 'counter-arguments' | 'draft';

export type SkillId = ActiveSkill | 'draft' | 'deep-research' | 'compare-cases' | 'verify-cites';

export const SKILLS: { id: SkillId; label: string; icon: IconName; available: boolean }[] = [
	{ id: 'draft', label: 'Draft', icon: 'squarePen', available: true },
	{ id: 'deep-research', label: 'Deep research', icon: 'telescope', available: true },
	{ id: 'compare-cases', label: 'Compare cases', icon: 'gitCompare', available: false },
	{ id: 'counter-arguments', label: 'Counter-args', icon: 'swords', available: true },
	{ id: 'verify-cites', label: 'Verify cites', icon: 'badgeCheck', available: false },
	{ id: 'summarize', label: 'Summarize', icon: 'list', available: true }
];

const ACTIVE: readonly string[] = ['summarize', 'counter-arguments', 'draft'];

export const isActiveSkill = (value: unknown): value is ActiveSkill =>
	typeof value === 'string' && ACTIVE.includes(value);

/**
 * Draft produces a document instead of an analysis, so it cannot be combined with the skills that
 * add to an analysis: switching one on switches the others off.
 */
export function toggleSkills(current: ActiveSkill[], skill: ActiveSkill): ActiveSkill[] {
	if (current.includes(skill)) return current.filter((active) => active !== skill);
	if (skill === 'draft') return ['draft'];
	return [...current.filter((active) => active !== 'draft'), skill];
}

export const skillLabel = (id: SkillId) => SKILLS.find((skill) => skill.id === id)?.label ?? id;
