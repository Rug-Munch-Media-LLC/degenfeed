'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/feed');
  }, [router]);
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <p className="text-sm text-gray-500">Loading…</p>
    </div>
  );
}
