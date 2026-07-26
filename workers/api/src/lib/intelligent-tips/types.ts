/** Types for the Intelligent Tips module. */
export type ContentVenue =
  | 'video'
  | 'live'
  | 'post'
  | 'comment'
  | 'dm'
  | 'podcast'
  | 'music'
  | 'article'
  | 'nft';
export type TipMethod =
  | 'lightning'
  | 'onchain'
  | 'x402'
  | 'internal'
  | 'l2'
  | 'zapper'
  | 'wallet'
  | 'zap'
  | 'frame'
  | 'fiat'
  | 'link';
export type TipVisibility = 'public' | 'private' | 'anonymous';
export type ContentCategory =
  | 'gaming'
  | 'music'
  | 'art'
  | 'tech'
  | 'defi'
  | 'nft'
  | 'social'
  | 'education'
  | 'entertainment'
  | 'news'
  | 'sports'
  | 'other';
export type TipperRelationship = 'first_time' | 'casual' | 'regular' | 'super_fan';
export interface TipSuggestion {
  amount: string;
  currency: string;
  label: string;
  reason: string;
  confidence: number;
}
export interface AmountIntelligenceInput {
  venue: ContentVenue;
  creatorWallet: string;
  tipperWallet: string;
  contentCategory?: ContentCategory;
  relationship?: TipperRelationship;
  protocol?: string;
}
export interface ProtocolTipCapability {
  protocol: string;
  methods: TipMethod[];
  currencies: string[];
  minAmount: string;
  maxAmount: string;
  feePercent: number;
  supportsMemo: boolean;
  supportsPrivate: boolean;
  supportsAnon: boolean;
}
export interface TipRouteResult {
  protocol: string;
  method: TipMethod;
  ok: boolean;
  txId?: string;
  error?: string;
}
export interface AmountSuggestionGroup {
  venue: ContentVenue;
  suggestions: TipSuggestion[];
  context: string;
}
export interface TipRecordForVisibility {
  protocol: string;
  method: TipMethod;
}
export interface TipVisibilityDecision {
  protocol: string;
  visibility: TipVisibility;
  enforceable: boolean;
  reason: string;
}
export interface TipNotificationPlan {
  deliverable: boolean;
  channels: string[];
  message: string;
  actionUrl?: string;
}
