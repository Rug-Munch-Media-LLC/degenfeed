'use client';

/**
 * @degenfeed/ui — the publish footer: targets, options, preview, submit.
 */

import type { TokenGate } from '@degenfeed/token-gate';
import type { ContentProof } from '@degenfeed/types';
import { ComposePreview } from '../ComposePreview';
import { TokenGateConfigurator } from '../TokenGateConfigurator';
import { ComposeFooter } from './ComposeFooter';
import { ComposeOptions } from './ComposeOptions';
import { PermanenceProofBadge } from './PermanenceProofBadge';
import { ProtocolPicker } from './ProtocolPicker';
import { ScheduledPostsPanel } from './ScheduledPostsPanel';
import { type ComposeTarget, MAX_CHARS, type ScheduledPostItem } from './types';

export interface PublishSectionProps {
  targets: ComposeTarget[];
  text: string;
  toggleTarget: (id: string) => void;
  nostrBridgePublicId?: string;
  bridgeToNostr: boolean;
  onBridgeChange: (checked: boolean) => void;
  lensCollect: boolean;
  onLensCollectChange: (checked: boolean) => void;
  makePermanent: boolean;
  onMakePermanentChange: (checked: boolean) => void;
  storingPermanent: boolean;
  permanenceProof: ContentProof | null;
  tokenGate: TokenGate | null;
  onTokenGateChange: (gate: TokenGate | null) => void;
  primaryIdentity?: { displayName?: string; handle?: string; avatarUrl?: string };
  scheduledPosts?: ScheduledPostItem[];
  showScheduledView: boolean;
  onPublishScheduledNow?: (id: string) => void;
  onCancelSchedule?: (id: string) => void;
  canSubmit: boolean;
  publishing: boolean;
  selectedCount: number;
  anyFailed: boolean;
  scheduledAt: Date | null;
  onPublish: () => void;
  onSchedule: () => void;
}

export function PublishSection(props: PublishSectionProps) {
  const lensEnabled = !!props.targets.find((t) => t.id === 'lens')?.enabled;
  const mastodonEnabled = !!props.targets.find((t) => t.id === 'mastodon')?.enabled;
  return (
    <div className="border-t border-[var(--color-border)] px-4 py-3">
      <ProtocolPicker
        targets={props.targets}
        textLength={props.text.length}
        onToggle={props.toggleTarget}
      />
      <ComposeOptions
        showBridgeOption={mastodonEnabled && !!props.nostrBridgePublicId}
        bridgeToNostr={props.bridgeToNostr}
        onBridgeChange={props.onBridgeChange}
        showLensOption={lensEnabled}
        lensCollect={props.lensCollect}
        onLensCollectChange={props.onLensCollectChange}
        makePermanent={props.makePermanent}
        onMakePermanentChange={props.onMakePermanentChange}
        storing={props.storingPermanent}
        permanenceProof={props.permanenceProof}
      />
      <div className="mb-3">
        <TokenGateConfigurator
          gate={props.tokenGate}
          onChange={props.onTokenGateChange}
          displaySymbol=""
          resolving={false}
          error={undefined}
        />
      </div>
      <ComposePreview
        text={props.text}
        targets={props.targets.map((t) => ({
          id: t.id,
          label: t.label,
          charLimit: t.charLimit,
          enabled: t.enabled,
        }))}
        author={props.text.trim() ? props.primaryIdentity : undefined}
      />
      {props.showScheduledView && props.scheduledPosts && props.scheduledPosts.length > 0 && (
        <ScheduledPostsPanel
          posts={props.scheduledPosts}
          onPublishNow={props.onPublishScheduledNow}
          onCancel={props.onCancelSchedule}
        />
      )}
      {props.permanenceProof && <PermanenceProofBadge proof={props.permanenceProof} />}
      <ComposeFooter
        textLength={props.text.length}
        charLimit={MAX_CHARS}
        canSubmit={props.canSubmit}
        publishing={props.publishing}
        busyLabel={props.scheduledAt ? '⏳ Scheduling…' : '⏳ Posting…'}
        primaryLabel={`${props.scheduledAt ? 'Schedule' : 'Post'}${
          props.selectedCount > 0 ? ` (${props.selectedCount})` : ''
        }`}
        failureMessage={props.anyFailed ? 'Some networks failed' : undefined}
        onClick={props.scheduledAt ? props.onSchedule : props.onPublish}
      />
    </div>
  );
}
