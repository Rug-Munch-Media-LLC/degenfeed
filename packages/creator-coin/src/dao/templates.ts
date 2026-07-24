/**
 * DegenFeed DAO Framework — DAO Templates
 *
 * Pre-built DAO templates that creators can choose from when creating
 * their coin. Each template comes with default voting configuration,
 * treasury allocation, and feature set.
 *
 * @see types.ts for DAOTemplate definitions
 */

import { DAO_TEMPLATES, type DAOTemplate, type DAOTemplateType, type VotingConfig } from './types';

export { DAO_TEMPLATES };

/**
 * Get a specific DAO template by type.
 */
export function getTemplate(type: DAOTemplateType): DAOTemplate {
  const template = DAO_TEMPLATES[type];
  if (!template) {
    throw new Error(`Unknown DAO template: ${type}`);
  }
  return template;
}

/**
 * Get all available DAO templates as a list.
 */
export function getAllTemplates(): DAOTemplate[] {
  return Object.values(DAO_TEMPLATES);
}

/**
 * Get template recommendations based on the creator's use case.
 */
export function getRecommendedTemplate(
  creatorType: 'artist' | 'developer' | 'influencer' | 'trader' | 'community',
): DAOTemplateType {
  const recommendations: Record<string, DAOTemplateType> = {
    artist: 'creator',
    developer: 'protocol',
    influencer: 'social',
    trader: 'investment',
    community: 'social',
  };
  return recommendations[creatorType] || 'social';
}

/**
 * Merge a template's default config with user overrides.
 */
export function mergeVotingConfig(
  template: DAOTemplateType,
  overrides?: Partial<VotingConfig>,
): VotingConfig {
  const defaults = DAO_TEMPLATES[template].defaultVotingConfig;
  if (!overrides) return { ...defaults };

  return {
    ...defaults,
    ...overrides,
  };
}

/**
 * Get a human-readable description of a template's purpose.
 */
export function getTemplateDescription(type: DAOTemplateType): string {
  const descriptions: Record<DAOTemplateType, string> = {
    investment:
      'Pool funds together and vote on investment strategies. Perfect for communities that want to collectively manage a treasury and make investment decisions.',
    creator:
      'Manage content strategy, revenue sharing, and partnerships. Ideal for creators who want to involve their community in creative and business decisions.',
    protocol:
      'Manage protocol parameters, fees, and upgrades. Built for projects that need formal governance with supermajority requirements and timelock security.',
    social:
      'Make community decisions with minimal friction. Great for social tokens, fan clubs, and communities that want lightweight governance.',
  };
  return descriptions[type] || '';
}

/**
 * Get the features description for a template.
 */
export function getTemplateFeatures(type: DAOTemplateType): string[] {
  const featureDescriptions: Record<string, Record<string, string>> = {
    investment: {
      treasury: 'Pooled treasury for collective investments',
      voting: 'Token-weighted voting on investment proposals',
      delegation: 'Delegate votes to trusted analysts',
      multisig_emergency: 'Emergency multisig for rapid response',
    },
    creator: {
      treasury: 'Revenue sharing treasury',
      voting: 'Community voting on creative direction',
      delegation: 'Delegate votes to curators',
      revenue_sharing: 'Automated revenue distribution',
    },
    protocol: {
      treasury: 'Protocol treasury management',
      voting: 'Supermajority voting for critical params',
      delegation: 'Delegate votes to governance experts',
      timelock: 'Timelock delay on all executions (48h)',
      multisig_emergency: 'Emergency pause capability',
    },
    social: {
      voting: 'Quick community polls and decisions',
      delegation: 'Delegate votes to active members',
      grants: 'Community grant allocation',
    },
  };

  const template = DAO_TEMPLATES[type];
  return template.features.map((f) => featureDescriptions[type]?.[f] || f);
}
