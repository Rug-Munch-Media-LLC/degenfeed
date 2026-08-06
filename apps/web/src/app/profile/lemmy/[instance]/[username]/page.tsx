'use client';

//
// /profile/lemmy/[instance]/[username] — nested Lemmy profile page.
//
// Lemmy identities are `user@instance`, so profile links use a nested route
// that preserves both parts (getInternalProfilePath in @degenfeed/utils):
//   /profile/lemmy/{instance}/{username}
// The two segments are recombined into `user@instance` and delegated to the
// shared ProfilePageContent, which matches against the author handle /
// native id on the lemmy feed.
//

import { use } from 'react';
import { ProfilePageContent } from '../../../_profile-content';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ instance: string; username: string }>;
}

export default function LemmyProfilePage({ params }: Props) {
  const { instance, username } = use(params);
  const id = `${username}@${instance}`;
  return <ProfilePageContent protocol="lemmy" id={id} />;
}
