'use client';

/**
 * @degenfeed/ui — state controller for the composer dialog.
 *
 * One hook owns every piece of composer state so the dialog view stays purely
 * presentational and the facade stays a two-line glue file.
 */

import type { TokenGate } from '@degenfeed/token-gate';
import type { ContentProof } from '@degenfeed/types';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { ComposeModalProps } from '../ComposeModal';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import type { ComposeController } from './controllerTypes';
import { requestTranslation } from './translate';
import { charLimitFor } from './types';
import { useComposePublish } from './useComposePublish';
import { useComposeTargets } from './useComposeTargets';
import { useComposeText } from './useComposeText';
import { useDraftPersistence } from './useDraftPersistence';
import { useFocusTrap } from './useFocusTrap';
import { useImageAttachments } from './useImageAttachments';
import { useReplyProtocol } from './useReplyProtocol';
import { useSubmitShortcut } from './useSubmitShortcut';
import { validateCompose } from './validation';

export function useComposeController(props: ComposeModalProps): ComposeController {
  const { open, onClose, signedInProtocols, onPublish, onSchedule, replyContext } = props;
  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [showScheduledView, setShowScheduledView] = useState(false);
  const [makePermanent, setMakePermanent] = useState(false);
  const [permanenceProof, setPermanenceProof] = useState<ContentProof | null>(null);
  const [storingPermanent, setStoringPermanent] = useState(false);
  const [bridgeToNostr, setBridgeToNostr] = useState(false);
  const [lensCollect, setLensCollect] = useState(false);
  const [tokenGate, setTokenGate] = useState<TokenGate | null>(null);

  const hasSignedIn = Object.values(signedInProtocols).some(Boolean);
  const scheduleAvailable = hasSignedIn && !!onSchedule;
  const composeText = useComposeText({
    fileInputRef,
    textareaRef,
    scheduleAvailable,
    onScheduleCommand: () => setShowSchedulePicker(true),
  });
  const { text, setText } = composeText;
  const { targets, setTargets, toggleTarget, selectedCount } = useComposeTargets({
    open,
    signedInProtocols,
    preselectProtocols: props.preselectProtocols,
    onRequestSignIn: props.onRequestSignIn,
  });
  const images = useImageAttachments(setText);
  const reply = useReplyProtocol({ open, replyContext, signedInProtocols });
  const { publishing, handlePublish, handleSchedule } = useComposePublish({
    text,
    targets,
    setTargets,
    onPublish,
    onClose,
    scheduledAt,
    onSchedule,
    bridgeToNostr,
    nostrBridgePublicId: props.nostrBridgePublicId,
    onNostrBridge: props.onNostrBridge,
    lensCollect,
    tokenGate,
    makePermanent,
    replyContext,
    replyProtocol: reply.replyProtocol,
    onCrossReply: props.onCrossReply,
    onStoringPermanent: setStoringPermanent,
    onPermanenceProof: setPermanenceProof,
  });
  const validation = useMemo(
    () => validateCompose(text, targets, publishing),
    [text, targets, publishing],
  );
  const enabledTargets = useMemo(
    () => Object.fromEntries(targets.map((t) => [t.id, t.enabled])),
    [targets],
  );
  const resetCompose = useCallback(() => {
    setScheduledAt(null);
    setShowSchedulePicker(false);
    setShowScheduledView(false);
  }, []);

  useDraftPersistence({
    open,
    text,
    enabledTargets,
    attachedImages: images.attachedImages,
    prefillText: props.prefillText,
    restore: setText,
    reset: resetCompose,
  });
  useFocusTrap(open, dialogRef, onClose);
  useSubmitShortcut(open, scheduledAt ? handleSchedule : handlePublish);
  const swipeHandlers = useSwipeToDismiss(onClose);

  const shortTarget = targets.find(
    (t) => t.enabled && t.charLimit < text.length && text.length > 500,
  );

  return {
    dialogRef,
    onClose,
    onTouchStart: swipeHandlers.onTouchStart,
    onTouchEnd: swipeHandlers.onTouchEnd,
    replyContext,
    scheduledPosts: props.scheduledPosts,
    showScheduledView,
    toggleScheduledView: () => setShowScheduledView((v) => !v),
    scheduledAt,
    hasSignedIn,
    text,
    onTextChange: composeText.handleTextChange,
    setText,
    textareaRef,
    fileInputRef,
    showSlashMenu: composeText.showSlashMenu,
    slashCommands: composeText.slashCommands,
    onSlashCommand: composeText.handleSlashCommand,
    attachedImages: images.attachedImages,
    uploadingImage: images.uploadingImage,
    onImageFile: images.handleImageFile,
    onRemoveImage: images.removeImage,
    showSchedulePicker: showSchedulePicker && scheduleAvailable,
    minPickerStr: new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16),
    onPickSchedule: (at: Date) => {
      setScheduledAt(at);
      setShowSchedulePicker(false);
    },
    onClearSchedule: resetCompose,
    prefillLabel: props.prefillLabel,
    shortTarget: shortTarget
      ? { id: shortTarget.id, label: shortTarget.label, charLimit: shortTarget.charLimit }
      : undefined,
    onTranslate: () => {
      if (!shortTarget) return;
      void requestTranslation(text, shortTarget.id).then((translated) => {
        if (translated) setText(translated);
      });
    },
    replyProtocols: reply.availableReplyProtocols,
    replyProtocol: reply.replyProtocol,
    onSelectReplyProtocol: reply.selectReplyProtocol,
    isCrossProtocolReply: reply.isCrossProtocolReply,
    replyLimit: charLimitFor(reply.replyProtocol),
    targets,
    toggleTarget,
    selectedCount,
    nostrBridgePublicId: props.nostrBridgePublicId,
    bridgeToNostr,
    onBridgeChange: setBridgeToNostr,
    lensCollect,
    onLensCollectChange: setLensCollect,
    makePermanent,
    onMakePermanentChange: setMakePermanent,
    storingPermanent,
    permanenceProof,
    tokenGate,
    onTokenGateChange: setTokenGate,
    primaryIdentity: props.primaryIdentity,
    onPublishScheduledNow: props.onPublishScheduledNow,
    onCancelSchedule: props.onCancelSchedule,
    canSubmit: validation.canSubmit,
    anyFailed: validation.anyFailed,
    publishing,
    onPublish: handlePublish,
    onSchedule: handleSchedule,
  };
}
