import type { PlanInfo } from './types';

export const PLANS: PlanInfo[] = [
  {
    id: 'free',
    label: 'Free',
    price: '$0',
    description: 'Basic social identity. No gas fees.',
    features: [
      'GoToSocial (Fediverse) account',
      'AT Protocol PDS (Bluesky) account',
      'Nostr keypair + RSS feed',
      'Recovery key package',
      'Self-custodied identity',
    ],
  },
  {
    id: 'standard',
    label: 'Standard',
    price: '$10',
    description: 'Everything plus Farcaster & Lens.',
    popular: true,
    features: [
      'All Free features',
      'Farcaster ID (Base)',
      'Lens Profile (Polygon)',
      'Short handle support',
      'Priority support',
    ],
  },
  {
    id: 'complete',
    label: 'Complete',
    price: '$20',
    description: 'Full suite with ENS domain.',
    features: [
      'All Standard features',
      'ENS domain (.eth)',
      'Optimized handle pricing',
      'Bundle discount (-$7)',
      'Priority gas estimation',
    ],
  },
];

export const STEPS = ['Plan', 'Usernames', 'Review', 'Sign', 'Processing', 'Success'];

export const PROCESSING_STEPS: { id: string; label: string }[] = [
  { id: 'activitypub', label: 'Creating GoToSocial account' },
  { id: 'atproto', label: 'Creating AT Protocol PDS account' },
  { id: 'nostr', label: 'Generating Nostr keypair' },
  { id: 'rss', label: 'Setting up RSS feed' },
  { id: 'farcaster', label: 'Registering Farcaster ID (Base tx)' },
  { id: 'lens', label: 'Creating Lens profile (Polygon tx)' },
  { id: 'ens', label: 'Registering ENS domain' },
  { id: 'storage', label: 'Storing credentials & recovery keys' },
];
