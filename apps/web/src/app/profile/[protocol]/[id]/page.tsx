'use client';

//
// /profile/[protocol]/[id] — external protocol profile page.
//
// Aggregates a user's profile + posts for ANY protocol (Nostr, Mastodon,
// Bluesky, Farcaster, Lens, Reddit, YouTube, SoundCloud, …) from our
// index. Post cards link here via the clickable author name/avatar in
// PostHeader (getAuthorProfileHref in @degenfeed/utils).
//
// Lemmy uses the nested route /profile/lemmy/[instance]/[username] (see
// ./lemmy/[instance]/[username]/page.tsx); the flat [id] form still works
// for a single-segment lemmy id (e.g. an encoded `user@instance`).
//

import { use } from 'react';
import { ProfilePageContent } from '../../_profile-content';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ protocol: string; id: string }>;
}

export default function ProtocolProfilePage({ params }: Props) {
  const { protocol, id } = use(params);
  return <ProfilePageContent protocol={protocol} id={id} />;
}
