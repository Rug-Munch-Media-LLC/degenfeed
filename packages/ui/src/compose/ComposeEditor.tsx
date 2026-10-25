'use client';

/**
 * @degenfeed/ui — the draft editor: textarea, image attachments, slash menu.
 */

import type { ChangeEvent, RefObject } from 'react';
import { MAX_CHARS } from './types';

export interface AttachedImage {
  src: string;
  alt: string;
}

export interface ComposeEditorProps {
  text: string;
  onChange: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onImageFile: (event: ChangeEvent<HTMLInputElement>) => void;
  showSlashMenu: boolean;
  slashCommands: string[];
  onSlashCommand: (command: string) => void;
  images: AttachedImage[];
  uploadingImage: boolean;
  onRemoveImage: (index: number) => void;
}

export function ComposeEditor({
  text,
  onChange,
  textareaRef,
  fileInputRef,
  onImageFile,
  showSlashMenu,
  slashCommands,
  onSlashCommand,
  images,
  uploadingImage,
  onRemoveImage,
}: ComposeEditorProps) {
  return (
    <>
      <textarea
        ref={textareaRef}
        id="compose-text"
        value={text}
        data-autofocus
        onChange={(e) => {
          onChange(e.target.value);
          const el = e.target;
          el.style.height = 'auto';
          el.style.height = `${el.scrollHeight}px`;
        }}
        placeholder="What's happening across the open social graph?"
        className="w-full resize-none bg-transparent text-base text-[var(--color-fg)] placeholder:text-[var(--color-muted)] outline-none"
        rows={4}
        maxLength={MAX_CHARS}
        aria-label="Post content"
        aria-describedby="compose-char-count"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onImageFile}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />

      {images.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2 p-0">
          {images.map((image, index) => (
            <li key={image.src.slice(-24)} className="group relative">
              {/* biome-ignore lint/performance/noImgElement: local data-URL attachment */}
              <img
                src={image.src}
                alt={image.alt}
                className="h-16 w-16 rounded-lg border border-[var(--color-border)] object-cover"
              />
              <button
                type="button"
                onClick={() => onRemoveImage(index)}
                className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-danger)] text-[10px] text-[var(--color-bg)] opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                aria-label={`Remove image ${index + 1}`}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </li>
          ))}
          {uploadingImage && (
            <li className="flex h-16 w-16 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]">
              <span className="animate-pulse text-xs text-[var(--color-muted)]" role="status">
                Uploading…
              </span>
            </li>
          )}
        </ul>
      )}

      {showSlashMenu && (
        <div
          role="menu"
          aria-label="Slash commands"
          className="mb-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-1"
        >
          {slashCommands.map((cmd) => (
            <button
              key={cmd}
              type="button"
              role="menuitem"
              className="w-full rounded px-3 py-1.5 text-left text-sm text-[var(--color-muted)] transition-colors hover:bg-[var(--color-bg)] hover:text-[var(--color-fg)]"
              onClick={() => onSlashCommand(cmd)}
            >
              /{cmd}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
