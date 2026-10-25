'use client';

/**
 * @degenfeed/ui — image attachments for the composer.
 *
 * Local data URLs only: the host uploads on publish. Guarded to images under
 * 10MB; the markdown reference is inserted into the draft so the post and the
 * preview stay in sync.
 */

import { type ChangeEvent, useCallback, useState } from 'react';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export interface UseImageAttachments {
  attachedImages: string[];
  uploadingImage: boolean;
  handleImageFile: (event: ChangeEvent<HTMLInputElement>) => void;
  removeImage: (index: number) => void;
}

export function useImageAttachments(
  setText: React.Dispatch<React.SetStateAction<string>>,
): UseImageAttachments {
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageFile = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) return;
      if (file.size > MAX_IMAGE_BYTES) return;
      setUploadingImage(true);
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setText((prev) => `${prev}\n![${file.name}](${dataUrl})\n`);
        setAttachedImages((prev) => [...prev, dataUrl]);
        setUploadingImage(false);
      };
      reader.onerror = () => setUploadingImage(false);
      reader.readAsDataURL(file);
      event.target.value = '';
    },
    [setText],
  );

  const removeImage = useCallback(
    (index: number) => {
      const src = attachedImages[index];
      if (!src) return;
      setAttachedImages((prev) => prev.filter((_, i) => i !== index));
      setText((prev) =>
        prev.replace(
          new RegExp(`!\\[.*?\\]\\(${src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)\\n?`),
          '',
        ),
      );
    },
    [attachedImages, setText],
  );

  return { attachedImages, uploadingImage, handleImageFile, removeImage };
}
