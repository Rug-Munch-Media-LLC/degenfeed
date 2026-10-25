'use client';

/**
 * @degenfeed/ui — the composer dialog, presentational only.
 */

import { ComposeEditor } from './ComposeEditor';
import { ComposeModalHeader } from './ComposeModalHeader';
import type { ComposeController } from './controllerTypes';
import { PublishSection } from './PublishSection';
import { ReplySection } from './ReplySection';
import { CrossProtocolNote, ReplySwitcher } from './ReplySwitcher';
import { SchedulePanel } from './SchedulePanel';
import { SignedOutPrompt } from './SignedOutPrompt';
import { PrefillBanner, TranslationOffer } from './TranslationOffer';

export function ComposeDialogView({ c }: { c: ComposeController }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close composer"
        tabIndex={-1}
        onClick={c.onClose}
        className="absolute inset-0 bg-[var(--color-overlay)] backdrop-blur-sm"
      />
      <div
        ref={c.dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="compose-dialog-title"
        className="relative flex w-full max-w-lg flex-col rounded-t-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl sm:rounded-2xl"
        style={{ maxHeight: '90vh' }}
        onTouchStart={c.onTouchStart}
        onTouchEnd={c.onTouchEnd}
      >
        <ComposeModalHeader
          titleId="compose-dialog-title"
          replyContext={c.replyContext}
          scheduledCount={c.scheduledPosts?.length ?? 0}
          showScheduledView={c.showScheduledView}
          onToggleScheduled={c.toggleScheduledView}
          hasSchedule={!!c.scheduledAt}
          onClose={c.onClose}
        />

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {c.hasSignedIn ? (
            <>
              <ComposeEditor
                text={c.text}
                onChange={c.onTextChange}
                textareaRef={c.textareaRef}
                fileInputRef={c.fileInputRef}
                onImageFile={c.onImageFile}
                showSlashMenu={c.showSlashMenu}
                slashCommands={c.slashCommands}
                onSlashCommand={c.onSlashCommand}
                images={c.attachedImages.map((src, i) => ({
                  src,
                  alt: `Attachment ${i + 1}`,
                }))}
                uploadingImage={c.uploadingImage}
                onRemoveImage={c.onRemoveImage}
              />
              <SchedulePanel
                scheduledAt={c.scheduledAt}
                showPicker={c.showSchedulePicker}
                minPickerStr={c.minPickerStr}
                onPick={c.onPickSchedule}
                onClear={c.onClearSchedule}
              />
              {c.prefillLabel && <PrefillBanner label={c.prefillLabel} />}
              {c.shortTarget && !c.prefillLabel && (
                <TranslationOffer
                  text={c.text}
                  targetLabel={c.shortTarget.label}
                  charLimit={c.shortTarget.charLimit}
                  onTranslate={c.onTranslate}
                />
              )}
            </>
          ) : (
            <SignedOutPrompt />
          )}
        </div>

        {c.replyContext && (
          <ReplySwitcher
            protocols={c.replyProtocols}
            selected={c.replyProtocol}
            parentProtocol={c.replyContext.parentProtocol}
            onSelect={c.onSelectReplyProtocol}
          />
        )}
        {c.replyContext && c.isCrossProtocolReply && (
          <CrossProtocolNote
            replyProtocol={c.replyProtocol}
            parentProtocol={c.replyContext.parentProtocol}
          />
        )}

        {c.hasSignedIn && !c.replyContext && (
          <PublishSection
            targets={c.targets}
            text={c.text}
            toggleTarget={c.toggleTarget}
            nostrBridgePublicId={c.nostrBridgePublicId}
            bridgeToNostr={c.bridgeToNostr}
            onBridgeChange={c.onBridgeChange}
            lensCollect={c.lensCollect}
            onLensCollectChange={c.onLensCollectChange}
            makePermanent={c.makePermanent}
            onMakePermanentChange={c.onMakePermanentChange}
            storingPermanent={c.storingPermanent}
            permanenceProof={c.permanenceProof}
            tokenGate={c.tokenGate}
            onTokenGateChange={c.onTokenGateChange}
            primaryIdentity={c.primaryIdentity}
            scheduledPosts={c.scheduledPosts}
            showScheduledView={c.showScheduledView}
            onPublishScheduledNow={c.onPublishScheduledNow}
            onCancelSchedule={c.onCancelSchedule}
            canSubmit={c.canSubmit}
            publishing={c.publishing}
            selectedCount={c.selectedCount}
            anyFailed={c.anyFailed}
            scheduledAt={c.scheduledAt}
            onPublish={c.onPublish}
            onSchedule={c.onSchedule}
          />
        )}

        {c.hasSignedIn && c.replyContext && (
          <ReplySection
            text={c.text}
            replyProtocol={c.replyProtocol}
            charLimit={c.replyLimit}
            isCrossProtocol={c.isCrossProtocolReply}
            targets={c.targets}
            publishing={c.publishing}
            primaryIdentity={c.primaryIdentity}
            onPublish={c.onPublish}
          />
        )}
      </div>
    </div>
  );
}
