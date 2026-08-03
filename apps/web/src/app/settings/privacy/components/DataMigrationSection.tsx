'use client';

import { MIGRATION_PLATFORMS } from '../constants';
import type { MigrationPlatform } from '../types';
import { MigrationCard } from './MigrationCard';

export function DataMigrationSection({ walletAddress }: { walletAddress: string | null }) {
  return (
    <div className="space-y-2">
      {MIGRATION_PLATFORMS.map((platform: MigrationPlatform) => (
        <MigrationCard
          key={platform.id}
          platform={platform}
          walletAddress={walletAddress}
          onStatusChange={() => {}}
        />
      ))}
    </div>
  );
}
