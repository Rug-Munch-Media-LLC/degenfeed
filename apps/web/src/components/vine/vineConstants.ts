/**
 * @components/vine — Vine Category Constants
 *
 * Vine-style categories with emoji, color, and metadata.
 */

export type VineCategory =
  | 'comedy'
  | 'music'
  | 'art'
  | 'magic'
  | 'tricks'
  | 'pets'
  | 'fails'
  | 'dance'
  | 'crypto'
  | 'memes'
  | 'pranks'
  | 'edits'
  | 'gaming'
  | 'reactions'
  | 'original_sound';

export const VINE_CATEGORIES: VineCategory[] = [
  'comedy',
  'music',
  'art',
  'magic',
  'tricks',
  'pets',
  'fails',
  'dance',
  'crypto',
  'memes',
  'pranks',
  'edits',
  'gaming',
  'reactions',
  'original_sound',
];

export const VINE_CATEGORY_META: Record<
  VineCategory,
  {
    label: string;
    emoji: string;
    color: string;
    description: string;
  }
> = {
  comedy: {
    label: 'Comedy',
    emoji: '😂',
    color: '#FF6B35',
    description: 'Funny clips, jokes, and hilarious moments',
  },
  music: {
    label: 'Music',
    emoji: '🎵',
    color: '#E91E63',
    description: 'Original songs, remixes, and music clips',
  },
  art: {
    label: 'Art',
    emoji: '🎨',
    color: '#9C27B0',
    description: 'Creative art, drawing, and digital creations',
  },
  magic: {
    label: 'Magic',
    emoji: '🪄',
    color: '#673AB7',
    description: 'Magic tricks and illusions',
  },
  tricks: {
    label: 'Tricks',
    emoji: '🛹',
    color: '#FF5722',
    description: 'Trick shots, flips, and stunts',
  },
  pets: { label: 'Pets', emoji: '🐱', color: '#FF9800', description: 'Cute and funny pet videos' },
  fails: {
    label: 'Fails',
    emoji: '💀',
    color: '#F44336',
    description: 'Epic fails and funny accidents',
  },
  dance: {
    label: 'Dance',
    emoji: '💃',
    color: '#E91E63',
    description: 'Dance moves and choreography',
  },
  crypto: {
    label: 'Crypto',
    emoji: '₿',
    color: '#00FF41',
    description: 'Crypto, DeFi, and Web3 content',
  },
  memes: {
    label: 'Memes',
    emoji: '🔥',
    color: '#FFD600',
    description: 'Dank memes and viral content',
  },
  pranks: { label: 'Pranks', emoji: '👻', color: '#FF4081', description: 'Pranks and surprises' },
  edits: {
    label: 'Edits',
    emoji: '✂️',
    color: '#00BCD4',
    description: 'Video edits and transitions',
  },
  gaming: {
    label: 'Gaming',
    emoji: '🎮',
    color: '#4CAF50',
    description: 'Gaming clips and highlights',
  },
  reactions: { label: 'Reactions', emoji: '😱', color: '#FF5252', description: 'Reaction videos' },
  original_sound: {
    label: 'Original Sound',
    emoji: '🔊',
    color: '#7C4DFF',
    description: 'Original audio creations',
  },
};
