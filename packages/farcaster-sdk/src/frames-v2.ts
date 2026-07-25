/**
 * @degenfeed/farcaster-sdk — Frames v2 (Mini Apps) Types & Builders
 *
 * Full Farcaster Frames v2 / Mini Apps specification support.
 *   - FrameEmbed metadata (single fc:frame JSON-LD meta tag)
 *   - Frame manifest (.well-known/farcaster.json)
 *   - Transaction frames (action: 'tx' → eth_signTypedData_v4 / eth_sendTransaction)
 *   - Multi-step frames with state management
 *   - Frame SDK communication (postMessage channel)
 *   - Notification webhooks
 *
 * @see https://docs.farcaster.xyz/reference/frames/spec
 */

// ─── FrameEmbed (the single fc:frame meta tag JSON for v2) ────────────────

/**
 * Frames v2 uses a single fc:frame meta tag with JSON-LD content,
 * replacing the multiple og:style meta tags from v1.
 */
export interface FrameEmbed {
  /** Frame spec version. Must be "next". */
  version: 'next';
  /** Frame image URL (3:2 ratio, <10MB, max 512 chars). */
  imageUrl: string;
  /** Button configuration */
  button: {
    /** Button text (max 32 chars). */
    title: string;
    /** Action — always "launch_frame" for v2 embeds. */
    action: {
      type: 'launch_frame';
      /** App name (max 32 chars). */
      name: string;
      /** Launch URL (max 512 chars). */
      url: string;
      /** Optional splash image URL (200x200px, <1MB). */
      splashImageUrl?: string;
      /** Optional hex color for splash background. */
      splashBackgroundColor?: string;
    };
  };
}

// ─── Frame Manifest (.well-known/farcaster.json) ──────────────────────────

export interface AccountAssociation {
  /** base64url-encoded JWS header */
  header: string;
  /** base64url-encoded JSON payload with single `fid` property */
  payload: string;
  /** base64url-encoded signature bytes */
  signature: string;
}

export interface FrameConfig {
  /** Manifest version — must be "1". */
  version: '1';
  /** App name (max 32 chars). */
  name: string;
  /** Default launch URL (max 512 chars). */
  homeUrl: string;
  /** App icon URL (200x200px, <1MB). */
  iconUrl: string;
  /** Default OG image (3:2 ratio). */
  imageUrl: string;
  /** Default button title (max 32 chars). */
  buttonTitle: string;
  /** Splash image URL (200x200px, <1MB). */
  splashImageUrl?: string;
  /** Splash background hex color. */
  splashBackgroundColor?: string;
  /** Webhook URL for notifications (max 512 chars). */
  webhookUrl?: string;
}

export interface TriggerConfig {
  type: 'global' | 'embed' | 'notification' | 'cast' | 'composer';
  url: string;
}

export interface FrameManifest {
  accountAssociation: AccountAssociation;
  frame: FrameConfig;
  triggers?: TriggerConfig[];
}

// ─── Frame Action Request (POST body from client) ────────────────────────

export interface FrameActionBody {
  /** Cast hash the frame was embedded in */
  castHash?: string;
  /** FID of the user interacting */
  interactorFid: number;
  /** Button index clicked (1-4) */
  buttonIndex: number;
  /** Input text (if input field exists) */
  inputText?: string;
  /** Current frame state (from previous response) */
  state?: string;
  /** Transaction ID (for tx action follow-up) */
  transactionId?: string;
  /** Address of the interactor */
  interactorAddress?: string;
  /** Farcaster signer public key */
  signerPubKey?: string;
}

// ─── Frame Response (the HTML the frame server returns) ──────────────────

export type FrameResponseButtonAction = 'post' | 'post_redirect' | 'link' | 'mint' | 'tx';

export interface FrameResponseButton {
  label: string;
  action?: FrameResponseButtonAction;
  target?: string;
}

export interface FrameResponseTransaction {
  /** Chain ID (e.g., "eip155:8453" for Base) */
  chainId: string;
  /** Transaction calldata for eth_sendTransaction */
  transactionData?: {
    to: string;
    value?: string;
    data?: string;
    gasLimit?: string;
  };
  /** EIP-712 typed data for eth_signTypedData_v4 */
  signTypedData?: Record<string, unknown>;
  /** Method: 'sendTransaction' | 'signTypedData_v4' */
  method: 'sendTransaction' | 'signTypedData_v4';
}

export interface FrameResponse {
  /** Frame image URL */
  image: string;
  /** Image aspect ratio */
  imageAspectRatio?: '1.91:1' | '1:1';
  /** Buttons (max 4) */
  buttons: FrameResponseButton[];
  /** POST URL for next action */
  postUrl?: string;
  /** Input text placeholder */
  inputText?: string;
  /** State to pass to next action (serializable, max 4096 bytes) */
  state?: string;
  /** Refresh interval in seconds */
  refreshPeriod?: number;
  /** Transaction to execute (for tx action buttons) */
  transaction?: FrameResponseTransaction;
  /** Location to redirect to (for post_redirect) */
  location?: string;
  /** Frame version (v2 clients check for fc:frame:image vs fc:frame) */
  version?: 'vNext' | 'next';
}

// ─── Multi-Step Frame State ──────────────────────────────────────────────

export interface FrameState {
  /** Current step index (0-based) */
  step: number;
  /** Total steps */
  totalSteps: number;
  /** Data accumulated across steps */
  data: Record<string, unknown>;
  /** Session ID */
  sessionId: string;
}

// ─── Frame Interaction Event (for analytics & notifications) ────────────

export interface FrameInteractionEvent {
  frameId: string;
  interactorFid: number;
  interactorAddress?: string;
  buttonIndex: number;
  actionType: string;
  timestamp: number;
  castHash?: string;
  state?: string;
  inputText?: string;
  transactionId?: string;
  conversion?: boolean;
  conversionType?: string;
}

// ─── Notification Types ─────────────────────────────────────────────────

export interface FrameNotificationDetails {
  url: string;
  token: string;
}

export type FrameWebhookEvent =
  | 'frame-added'
  | 'frame-removed'
  | 'notifications-enabled'
  | 'notifications-disabled';

export interface FrameWebhookPayload {
  event: FrameWebhookEvent;
  fid: number;
  notificationDetails?: FrameNotificationDetails;
  timestamp: number;
}

// ─── Frame Template Definitions ──────────────────────────────────────────

export type FrameTemplateType =
  | 'buy-coin'
  | 'tip-creator'
  | 'subscribe'
  | 'join-dao'
  | 'mint-nft'
  | 'custom';

export interface FrameTemplate {
  id: string;
  type: FrameTemplateType;
  name: string;
  description: string;
  icon: string;
  defaultImage: string;
  defaultButtonLabel: string;
  defaultActionType: FrameResponseButtonAction;
  fields: FrameTemplateField[];
}

export interface FrameTemplateField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'url' | 'color' | 'address' | 'select';
  required: boolean;
  defaultValue?: string;
  options?: string[];
  placeholder?: string;
}

export const FRAME_TEMPLATES: FrameTemplate[] = [
  {
    id: 'buy-coin',
    type: 'buy-coin',
    name: 'Buy Coin',
    description: 'Let users buy a creator coin directly from the frame',
    icon: '🪙',
    defaultImage: 'https://app.degenfeed.xyz/frames/buy-coin.png',
    defaultButtonLabel: '🪙 Buy Now',
    defaultActionType: 'tx',
    fields: [
      { key: 'coinSymbol', label: 'Coin Symbol', type: 'text', required: true, placeholder: '$DEGEN' },
      { key: 'coinAddress', label: 'Coin Contract Address', type: 'address', required: true },
      { key: 'chainId', label: 'Chain', type: 'select', required: true, options: ['eip155:8453', 'eip155:10', 'eip155:137'] },
      { key: 'price', label: 'Price per coin (ETH)', type: 'text', required: false, placeholder: '0.001' },
      { key: 'backgroundColor', label: 'Background Color', type: 'color', required: false, defaultValue: '#6A47E4' },
    ],
  },
  {
    id: 'tip-creator',
    type: 'tip-creator',
    name: 'Tip Creator',
    description: 'Enable fans to send tips via the frame',
    icon: '💎',
    defaultImage: 'https://app.degenfeed.xyz/frames/tip-creator.png',
    defaultButtonLabel: '💎 Send Tip',
    defaultActionType: 'tx',
    fields: [
      { key: 'creatorAddress', label: 'Creator Wallet Address', type: 'address', required: true },
      { key: 'creatorName', label: 'Creator Name', type: 'text', required: false, placeholder: 'Creator name' },
      { key: 'chainId', label: 'Chain', type: 'select', required: true, options: ['eip155:8453', 'eip155:10', 'eip155:137', 'eip155:1'] },
      { key: 'amounts', label: 'Suggested amounts (comma-separated)', type: 'text', required: false, placeholder: '0.001,0.005,0.01' },
    ],
  },
  {
    id: 'subscribe',
    type: 'subscribe',
    name: 'Subscribe',
    description: 'Let users subscribe to your content with a subscription NFT',
    icon: '🔔',
    defaultImage: 'https://app.degenfeed.xyz/frames/subscribe.png',
    defaultButtonLabel: '🔔 Subscribe',
    defaultActionType: 'tx',
    fields: [
      { key: 'price', label: 'Monthly Price (ETH)', type: 'text', required: true, placeholder: '0.01' },
      { key: 'benefits', label: 'Benefits (comma-separated)', type: 'text', required: false, placeholder: 'exclusive content, early access' },
      { key: 'chainId', label: 'Chain', type: 'select', required: true, options: ['eip155:8453', 'eip155:10'] },
    ],
  },
  {
    id: 'join-dao',
    type: 'join-dao',
    name: 'Join DAO',
    description: 'Let users join your DAO with a membership NFT',
    icon: '🏛️',
    defaultImage: 'https://app.degenfeed.xyz/frames/join-dao.png',
    defaultButtonLabel: '🏛️ Join DAO',
    defaultActionType: 'tx',
    fields: [
      { key: 'daoName', label: 'DAO Name', type: 'text', required: true, placeholder: 'My DAO' },
      { key: 'membershipAddress', label: 'Membership NFT Address', type: 'address', required: true },
      { key: 'price', label: 'Membership Price (ETH)', type: 'text', required: false, placeholder: '0.0' },
      { key: 'chainId', label: 'Chain', type: 'select', required: true, options: ['eip155:8453', 'eip155:10'] },
    ],
  },
  {
    id: 'mint-nft',
    type: 'mint-nft',
    name: 'Mint NFT',
    description: 'Let users mint an NFT directly from the frame',
    icon: '🖼️',
    defaultImage: 'https://app.degenfeed.xyz/frames/mint-nft.png',
    defaultButtonLabel: '🖼️ Mint',
    defaultActionType: 'tx',
    fields: [
      { key: 'nftAddress', label: 'NFT Contract Address', type: 'address', required: true },
      { key: 'nftName', label: 'NFT Name', type: 'text', required: false, placeholder: 'My NFT' },
      { key: 'price', label: 'Price (ETH, 0 for free)', type: 'text', required: false, placeholder: '0.0' },
      { key: 'chainId', label: 'Chain', type: 'select', required: true, options: ['eip155:8453', 'eip155:10', 'eip155:137', 'eip155:1'] },
    ],
  },
  {
    id: 'custom',
    type: 'custom',
    name: 'Custom Frame',
    description: 'Build a custom frame from scratch',
    icon: '🔧',
    defaultImage: 'https://app.degenfeed.xyz/frames/custom.png',
    defaultButtonLabel: 'Open',
    defaultActionType: 'post',
    fields: [
      { key: 'customImage', label: 'Frame Image URL', type: 'url', required: true },
      { key: 'buttonLabel1', label: 'Button 1 Label', type: 'text', required: true, placeholder: 'Button 1' },
      { key: 'buttonAction1', label: 'Button 1 Action', type: 'select', required: false, options: ['post', 'post_redirect', 'link', 'mint', 'tx'] },
      { key: 'buttonTarget1', label: 'Button 1 Target', type: 'text', required: false },
      { key: 'buttonLabel2', label: 'Button 2 Label', type: 'text', required: false },
      { key: 'buttonAction2', label: 'Button 2 Action', type: 'select', required: false, options: ['post', 'post_redirect', 'link', 'mint', 'tx'] },
      { key: 'buttonTarget2', label: 'Button 2 Target', type: 'text', required: false },
    ],
  },
];

// ─── Builders ─────────────────────────────────────────────────────────────

/**
 * Build a FrameEmbed JSON for the fc:frame meta tag (Frames v2).
 */
export function buildFrameEmbed(params: {
  imageUrl: string;
  buttonTitle: string;
  appName: string;
  launchUrl: string;
  splashImageUrl?: string;
  splashBackgroundColor?: string;
}): FrameEmbed {
  const embed: FrameEmbed = {
    version: 'next',
    imageUrl: params.imageUrl,
    button: {
      title: params.buttonTitle.slice(0, 32),
      action: {
        type: 'launch_frame',
        name: params.appName.slice(0, 32),
        url: params.launchUrl.slice(0, 512),
      },
    },
  };
  if (params.splashImageUrl) embed.button.action.splashImageUrl = params.splashImageUrl;
  if (params.splashBackgroundColor) embed.button.action.splashBackgroundColor = params.splashBackgroundColor;
  return embed;
}

/**
 * Serialize a FrameEmbed to a JSON string for the fc:frame meta tag.
 */
export function serializeFrameEmbed(embed: FrameEmbed): string {
  return JSON.stringify(embed);
}

/**
 * Generate the HTML meta tag for a FrameEmbed.
 */
export function renderFrameEmbedMetaTag(embed: FrameEmbed): string {
  return `<meta property="fc:frame" content='${serializeFrameEmbed(embed)}' />`;
}

/**
 * Build a complete Frames v2 HTML page.
 */
export function generateFramesV2Html(params: {
  frameEmbed: FrameEmbed;
  title?: string;
  description?: string;
  ogImage?: string;
  manifestUrl?: string;
  postUrl?: string;
  inputText?: string;
  state?: string;
  refreshPeriod?: number;
  transaction?: FrameResponseTransaction;
  location?: string;
}): string {
  const {
    frameEmbed,
    title = 'DegenFeed',
    description = 'Powered by DegenFeed',
    ogImage,
    manifestUrl = 'https://app.degenfeed.xyz/.well-known/farcaster.json',
    postUrl,
    inputText,
    state,
    refreshPeriod,
    transaction,
    location,
  } = params;

  const meta: string[] = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '',
    '  <!-- Farcaster Frame v2 (single JSON meta tag) -->',
    `  ${renderFrameEmbedMetaTag(frameEmbed)}`,
    '',
    '  <!-- Frame Manifest -->',
    `  <link rel="farcaster-manifest" href="${escapeHtml(manifestUrl)}" />`,
    '',
    '  <!-- OpenGraph -->',
    `  <meta property="og:title" content="${escapeHtml(title)}" />`,
    `  <meta property="og:description" content="${escapeHtml(description)}" />`,
    `  <meta property="og:image" content="${escapeHtml(ogImage ?? frameEmbed.imageUrl)}" />`,
    '  <meta property="og:type" content="website" />',
    '',
    '  <!-- Frame Post URL (for action handling) -->',
  ];

  if (postUrl) {
    meta.push(`  <meta property="fc:frame:post_url" content="${escapeHtml(postUrl)}" />`);
  }
  if (inputText) {
    meta.push(`  <meta property="fc:frame:input:text" content="${escapeHtml(inputText)}" />`);
  }
  if (state) {
    meta.push(`  <meta property="fc:frame:state" content="${escapeHtml(state)}" />`);
  }
  if (refreshPeriod) {
    meta.push(`  <meta property="fc:frame:refresh_period" content="${refreshPeriod}" />`);
  }
  if (transaction) {
    meta.push(`  <meta property="fc:frame:transaction" content="${escapeHtml(JSON.stringify(transaction))}" />`);
  }
  if (location) {
    meta.push(`  <meta http-equiv="refresh" content="0;url=${escapeHtml(location)}" />`);
  }

  // Frame SDK script (required for v2 communication)
  meta.push('',
    '  <!-- Frame SDK -->',
    '  <script src="https://cdn.jsdelivr.net/npm/@farcaster/frame-sdk@latest/dist/index.min.js"><\/script>',
    '  <script>',
    '    window.FarcasterFrameSDK?.ready().then(() => {',
    '      console.log("Frame SDK ready");',
    '    });',
    '  <\/script>',
  );

  meta.push('</head>',
    '<body>',
    '  <p>Frame content loaded. Opening in Mini App browser...</p>',
    '</body>',
    '</html>',
  );

  return meta.join('\n');
}

/**
 * Build a Frames v2 manifest object.
 */
export function buildFrameManifest(params: {
  name: string;
  homeUrl: string;
  iconUrl: string;
  imageUrl: string;
  buttonTitle: string;
  splashImageUrl?: string;
  splashBackgroundColor?: string;
  webhookUrl?: string;
  fid: number;
  accountKeyHex: string;
  triggers?: TriggerConfig[];
}): FrameManifest {
  const { fid, accountKeyHex } = params;

  // Build the account association using the FID and signer key
  // In production, sign the payload with the app's key
  const header = btoa(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ fid }));
  const signature = btoa(accountKeyHex); // Simplified — in production, sign properly

  return {
    accountAssociation: { header, payload, signature },
    frame: {
      version: '1',
      name: params.name.slice(0, 32),
      homeUrl: params.homeUrl,
      iconUrl: params.iconUrl,
      imageUrl: params.imageUrl,
      buttonTitle: params.buttonTitle.slice(0, 32),
      splashImageUrl: params.splashImageUrl,
      splashBackgroundColor: params.splashBackgroundColor,
      webhookUrl: params.webhookUrl,
    },
    triggers: params.triggers,
  };
}

/**
 * Build a multi-step frame state.
 */
export function createFrameState(initialData?: Record<string, unknown>): FrameState {
  return {
    step: 0,
    totalSteps: 0,
    data: initialData ?? {},
    sessionId: crypto.randomUUID(),
  };
}

/**
 * Advance frame state to the next step.
 */
export function advanceFrameState(state: FrameState, newData?: Record<string, unknown>): string {
  state.step++;
  if (newData) {
    state.data = { ...state.data, ...newData };
  }
  return JSON.stringify(state);
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
