'use client';

/**
 * @degenfeed/ui — draft text plus slash-command menu behaviour.
 */

import { type RefObject, useCallback, useState } from 'react';
import { MAX_CHARS } from './types';

export interface UseComposeTextArgs {
  fileInputRef: RefObject<HTMLInputElement | null>;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  scheduleAvailable: boolean;
  onScheduleCommand: () => void;
}

export interface UseComposeText {
  text: string;
  setText: React.Dispatch<React.SetStateAction<string>>;
  showSlashMenu: boolean;
  handleTextChange: (value: string) => void;
  handleSlashCommand: (command: string) => void;
  slashCommands: string[];
}

export function useComposeText({
  fileInputRef,
  textareaRef,
  scheduleAvailable,
  onScheduleCommand,
}: UseComposeTextArgs): UseComposeText {
  const [text, setText] = useState('');
  const [showSlashMenu, setShowSlashMenu] = useState(false);

  const handleTextChange = useCallback((value: string) => {
    if (value.length > MAX_CHARS) return;
    setText(value);
    const lines = value.split('\n');
    const lastLine = lines[lines.length - 1] ?? '';
    setShowSlashMenu(lastLine.startsWith('/') && lastLine.length > 1 && !lastLine.includes(' '));
  }, []);

  /** Drop the in-progress slash-command line. */
  const removeSlashLine = useCallback(
    () => text.slice(0, text.length - (text.split('\n').pop()?.length ?? 0)),
    [text],
  );

  const insert = useCallback(
    (cmd: string) => {
      setText(`${removeSlashLine() + cmd} `);
      setShowSlashMenu(false);
      textareaRef.current?.focus();
    },
    [removeSlashLine, textareaRef],
  );

  const handleSlashCommand = useCallback(
    (cmd: string) => {
      if (cmd === 'schedule') {
        setText(removeSlashLine());
        setShowSlashMenu(false);
        onScheduleCommand();
        textareaRef.current?.focus();
        return;
      }
      if (cmd === 'image') {
        setText(removeSlashLine());
        setShowSlashMenu(false);
        fileInputRef.current?.click();
        return;
      }
      insert(`/${cmd}`);
    },
    [removeSlashLine, insert, onScheduleCommand, fileInputRef, textareaRef],
  );

  return {
    text,
    setText,
    showSlashMenu,
    handleTextChange,
    handleSlashCommand,
    slashCommands: [
      'poll',
      'image',
      'link',
      'code',
      'thread',
      ...(scheduleAvailable ? ['schedule'] : []),
    ],
  };
}
