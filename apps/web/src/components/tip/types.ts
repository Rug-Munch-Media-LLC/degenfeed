export type ContentVenue = 'our_network' | 'external_protocol' | 'cross_platform' | 'comment_reply';

export interface TipMenuOption {
  method: string;
  label: string;
  description: string;
  icon: string;
  available: boolean;
  fee: string;
  feeUsd: number;
  recommended: boolean;
  isNative: boolean;
  isBridge: boolean;
  actionUrl?: string;
  address?: string;
  chain?: string;
}

export interface PastTip {
  tipperName: string;
  amountUsd: number;
  method: string;
  at: number;
}

export interface TipMenuProps {
  venue: ContentVenue;
  protocol: string;
  authorId: string;
  authorDisplayName: string;
  publicationId?: string;
  contentUrl?: string;
  hasWallet?: boolean;
  creatorAddresses?: {
    evm?: string;
    solana?: string;
    lightning?: string;
  };
  pastTips?: PastTip[];
  totalTipsUsd?: number;
  onTipInitiated?: (method: string, amount: string) => void;
  className?: string;
  compact?: boolean;
}
