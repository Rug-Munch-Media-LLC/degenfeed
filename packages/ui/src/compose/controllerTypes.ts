/**
 * @degenfeed/ui — the controller contract consumed by the dialog view.
 */

import type { TokenGate } from '@degenfeed/token-gate';
import type { ContentProof } from '@degenfeed/types';
import type { RefObject } from 'react';
import type { ComposeModalProps } from '../ComposeModal';
import type { ComposeTarget } from './types';

export interface ComposeController {
  dialogRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onTouchStart?: (event: React.TouchEvent<HTMLDivElement>) => void;
  onTouchEnd?: (event: React.TouchEvent<HTMLDivElement>) => void;
  replyContext?: ComposeModalProps['replyContext'];
  scheduledPosts?: ComposeModalProps['scheduledPosts'];
  showScheduledView: boolean;
  toggleScheduledView: () => void;
  scheduledAt: Date | null;
  hasSignedIn: boolean;
  text: string;
  onTextChange: (value: string) => void;
  setText: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  showSlashMenu: boolean;
  slashCommands: string[];
  onSlashCommand: (command: string) => void;
  attachedImages: string[];
  uploadingImage: boolean;
  onImageFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (index: number) => void;
  showSchedulePicker: boolean;
  minPickerStr: string;
  onPickSchedule: (at: Date) => void;
  onClearSchedule: () => void;
  prefillLabel?: string;
  shortTarget?: { id: string; label: string; charLimit: number };
  onTranslate: () => void;
  replyProtocols: string[];
  replyProtocol: string;
  onSelectReplyProtocol: (protocol: string) => void;
  isCrossProtocolReply: boolean;
  replyLimit: number;
  targets: ComposeTarget[];
  toggleTarget: (id: string) => void;
  selectedCount: number;
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
  primaryIdentity?: ComposeModalProps['primaryIdentity'];
  onPublishScheduledNow?: (id: string) => void;
  onCancelSchedule?: (id: string) => void;
  canSubmit: boolean;
  anyFailed: boolean;
  publishing: boolean;
  onPublish: () => void;
  onSchedule: () => void;
}
