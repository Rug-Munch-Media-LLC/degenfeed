'use client';

import { SelectRow } from './SelectRow';
import { TagList } from './TagList';
import type { Preferences } from './types';

interface ContentSectionProps {
  prefs: Preferences;
  setContent: (c: Partial<Preferences['content']>) => void;
  addMutedWord: (w: string) => void;
  removeMutedWord: (w: string) => void;
  addMutedUser: (u: string) => void;
  removeMutedUser: (u: string) => void;
  addBlockedUser: (u: string) => void;
  removeBlockedUser: (u: string) => void;
}

export function ContentSection({
  prefs,
  setContent,
  addMutedWord,
  removeMutedWord,
  addMutedUser,
  removeMutedUser,
  addBlockedUser,
  removeBlockedUser,
}: ContentSectionProps) {
  return (
    <div>
      <SelectRow
        id="settings-default-feed"
        label="Default feed"
        value={prefs.content.defaultFeed}
        options={[
          { value: 'following', label: 'Following' },
          { value: 'for-you', label: 'For You' },
          { value: 'trending', label: 'Trending' },
        ]}
        onChange={(v) =>
          setContent({ ...prefs.content, defaultFeed: v as 'following' | 'for-you' | 'trending' })
        }
      />
      <div>
        <span className="mb-1.5 block text-sm text-[var(--color-fg)]">Muted Words</span>
        <TagList
          items={prefs.content.mutedWords}
          onRemove={removeMutedWord}
          onAdd={addMutedWord}
          placeholder="Add word or phrase..."
          addLabel="Add"
        />
      </div>
      <div>
        <span className="mb-1.5 block text-sm text-[var(--color-fg)]">Muted Users</span>
        <TagList
          items={prefs.content.mutedUsers}
          onRemove={removeMutedUser}
          onAdd={addMutedUser}
          placeholder="User ID or handle..."
          addLabel="Mute"
        />
      </div>
      <div>
        <span className="mb-1.5 block text-sm text-[var(--color-fg)]">Blocked Users</span>
        <TagList
          items={prefs.content.blockedUsers}
          onRemove={removeBlockedUser}
          onAdd={addBlockedUser}
          placeholder="User ID or handle..."
          addLabel="Block"
        />
      </div>
    </div>
  );
}
