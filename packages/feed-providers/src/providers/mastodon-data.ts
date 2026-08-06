export const DEFAULT_GTS_INSTANCE = 'https://social.degenfeed.xyz';

// ─── Software type detection ──────────────────────────────────────────
// Each instance URL is tagged with its fediverse software so we can
// render the correct badge and adapt API calls if needed.
export type FediverseSoftware = 'mastodon' | 'pleroma' | 'akkoma' | 'misskey' | 'firefish';

export interface FediverseInstance {
  url: string;
  weight: number;
  label: string;
  software: FediverseSoftware;
  /** Topics this instance is known for (for relevance scoring) */
  topics: string[];
}

/**
 * Expanded fediverse instance list (2026-07-18).
 * 45+ Mastodon + Pleroma/Akkoma + Misskey/Firefish instances.
 * All instances speak the Mastodon REST API for trending/timeline/hashtag
 * endpoints (Misskey/Firefish have a Mastodon-compat layer). If the
 * native endpoint fails we degrade gracefully.
 */
export const TRENDING_INSTANCES: FediverseInstance[] = [
  // ── Mastodon: General / Large ─────────────────────────────────
  {
    url: 'https://mastodon.social',
    weight: 0.8,
    label: 'Mastodon',
    software: 'mastodon',
    topics: ['general', 'tech'],
  },
  {
    url: 'https://mas.to',
    weight: 0.7,
    label: 'MasTo',
    software: 'mastodon',
    topics: ['general', 'tech'],
  },
  {
    url: 'https://mstdn.social',
    weight: 0.7,
    label: 'Mstdn',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.world',
    weight: 0.8,
    label: 'World',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.online',
    weight: 0.7,
    label: 'Online',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.cloud',
    weight: 0.7,
    label: 'Cloud',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://ohai.social',
    weight: 0.7,
    label: 'Ohai',
    software: 'mastodon',
    topics: ['general', 'tech'],
  },
  {
    url: 'https://universeodon.com',
    weight: 0.7,
    label: 'Universe',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.scot',
    weight: 0.6,
    label: 'Scot',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.au',
    weight: 0.6,
    label: 'AU',
    software: 'mastodon',
    topics: ['general'],
  },
  // ── Mastodon: General / Large (EXPANDED 2026-08-06) ─────────
  {
    url: 'https://c.im',
    weight: 0.7,
    label: 'C.im',
    software: 'mastodon',
    topics: ['general', 'tech'],
  },
  {
    url: 'https://toot.community',
    weight: 0.6,
    label: 'TootCommunity',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mstdn.party',
    weight: 0.6,
    label: 'MstdnParty',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://tech.lgbt',
    weight: 0.7,
    label: 'TechLGBT',
    software: 'mastodon',
    topics: ['tech', 'general'],
  },
  {
    url: 'https://tapbots.social',
    weight: 0.6,
    label: 'Tapbots',
    software: 'mastodon',
    topics: ['general', 'tech'],
  },

  // ── Mastodon: Crypto / Bitcoin / Web3 ──────────────────────────
  {
    url: 'https://noagendasocial.com',
    weight: 0.8,
    label: 'NoAgenda',
    software: 'mastodon',
    topics: ['crypto', 'news'],
  },
  {
    url: 'https://satoshis.space',
    weight: 0.8,
    label: 'Sats',
    software: 'mastodon',
    topics: ['bitcoin', 'crypto'],
  },
  {
    url: 'https://sovereignfinance.social',
    weight: 0.7,
    label: 'Sovereign',
    software: 'mastodon',
    topics: ['bitcoin', 'finance'],
  },

  // ── Mastodon: Tech / FOSS / Engineering ────────────────────────
  {
    url: 'https://hachyderm.io',
    weight: 0.9,
    label: 'Hachyderm',
    software: 'mastodon',
    topics: ['tech', 'dev'],
  },
  {
    url: 'https://fosstodon.org',
    weight: 0.9,
    label: 'FOSStodon',
    software: 'mastodon',
    topics: ['foss', 'tech', 'linux'],
  },
  {
    url: 'https://techhub.social',
    weight: 0.9,
    label: 'TechHub',
    software: 'mastodon',
    topics: ['tech', 'dev'],
  },
  {
    url: 'https://social.linux.pizza',
    weight: 0.7,
    label: 'LinuxPizza',
    software: 'mastodon',
    topics: ['linux', 'foss'],
  },
  {
    url: 'https://merveilles.town',
    weight: 0.7,
    label: 'Merveilles',
    software: 'mastodon',
    topics: ['tech', 'art'],
  },
  {
    url: 'https://indieweb.social',
    weight: 0.7,
    label: 'IndieWeb',
    software: 'mastodon',
    topics: ['web', 'indie'],
  },
  {
    url: 'https://front-end.social',
    weight: 0.7,
    label: 'FrontEnd',
    software: 'mastodon',
    topics: ['web', 'dev'],
  },
  {
    url: 'https://awscommunity.social',
    weight: 0.6,
    label: 'AWS',
    software: 'mastodon',
    topics: ['cloud', 'dev'],
  },
  {
    url: 'https://phpc.social',
    weight: 0.6,
    label: 'PHPC',
    software: 'mastodon',
    topics: ['dev', 'php'],
  },
  {
    url: 'https://furry.engineer',
    weight: 0.6,
    label: 'FurryEng',
    software: 'mastodon',
    topics: ['tech', 'dev'],
  },

  // ── Mastodon: InfoSec / Privacy / Security ─────────────────────
  {
    url: 'https://infosec.exchange',
    weight: 1.0,
    label: 'InfoSec',
    software: 'mastodon',
    topics: ['security', 'infosec'],
  },
  {
    url: 'https://ioc.exchange',
    weight: 0.8,
    label: 'IOC',
    software: 'mastodon',
    topics: ['threatintel', 'security'],
  },
  {
    url: 'https://defcon.social',
    weight: 0.9,
    label: 'DEFCON',
    software: 'mastodon',
    topics: ['security', 'hacking'],
  },
  {
    url: 'https://infosec.town',
    weight: 0.8,
    label: 'InfoSecTown',
    software: 'mastodon',
    topics: ['security', 'infosec'],
  },
  {
    url: 'https://hackers.town',
    weight: 0.8,
    label: 'HackersTown',
    software: 'mastodon',
    topics: ['tech', 'hacking'],
  },
  {
    url: 'https://layer8.space',
    weight: 0.8,
    label: 'Layer8',
    software: 'mastodon',
    topics: ['security', 'tech'],
  },
  {
    url: 'https://cyberplace.social',
    weight: 0.7,
    label: 'Cyber',
    software: 'mastodon',
    topics: ['security', 'tech'],
  },
  {
    url: 'https://nurse.social',
    weight: 0.5,
    label: 'Nurse',
    software: 'mastodon',
    topics: ['health', 'general'],
  },

  // ── Mastodon: Science / Math / Academic ─────────────────────────
  {
    url: 'https://mathstodon.xyz',
    weight: 0.7,
    label: 'Mathstodon',
    software: 'mastodon',
    topics: ['math', 'science'],
  },
  {
    url: 'https://mastodon.energy',
    weight: 0.7,
    label: 'Energy',
    software: 'mastodon',
    topics: ['energy', 'climate'],
  },
  {
    url: 'https://scholar.social',
    weight: 0.7,
    label: 'Scholar',
    software: 'mastodon',
    topics: ['academic', 'science'],
  },
  {
    url: 'https://scicomm.xyz',
    weight: 0.6,
    label: 'SciComm',
    software: 'mastodon',
    topics: ['science', 'communication'],
  },
  {
    url: 'https://ecoevo.social',
    weight: 0.6,
    label: 'EcoEvo',
    software: 'mastodon',
    topics: ['science', 'ecology'],
  },
  {
    url: 'https://historically.exposed',
    weight: 0.5,
    label: 'History',
    software: 'mastodon',
    topics: ['history', 'research'],
  },

  // ── Mastodon: Art / Creative ───────────────────────────────────
  {
    url: 'https://mastodon.art',
    weight: 0.6,
    label: 'Art',
    software: 'mastodon',
    topics: ['art', 'creative'],
  },
  {
    url: 'https://photog.social',
    weight: 0.5,
    label: 'Photo',
    software: 'mastodon',
    topics: ['photography', 'art'],
  },
  {
    url: 'https://writing.exchange',
    weight: 0.6,
    label: 'Writing',
    software: 'mastodon',
    topics: ['writing', 'publishing'],
  },

  // ── Pleroma / Akkoma (Mastodon-API-compatible) ─────────────────
  {
    url: 'https://gleasonator.com',
    weight: 0.7,
    label: 'Gleason',
    software: 'pleroma',
    topics: ['tech', 'foss'],
  },
  {
    url: 'https://nicecrew.digital',
    weight: 0.6,
    label: 'NiceCrew',
    software: 'pleroma',
    topics: ['general', 'news'],
  },
  {
    url: 'https://bae.st',
    weight: 0.6,
    label: 'Bae',
    software: 'pleroma',
    topics: ['general', 'tech'],
  },
  {
    url: 'https://shitpost.cloud',
    weight: 0.5,
    label: 'Shitpost',
    software: 'pleroma',
    topics: ['memes', 'general'],
  },
  {
    url: 'https://sleepiness.cc',
    weight: 0.5,
    label: 'Sleepy',
    software: 'pleroma',
    topics: ['general', 'tech'],
  },
  {
    url: 'https://akko.bune.city',
    weight: 0.6,
    label: 'BuneCity',
    software: 'akkoma',
    topics: ['tech', 'general'],
  },
  {
    url: 'https://pub.solar',
    weight: 0.6,
    label: 'PubSolar',
    software: 'pleroma',
    topics: ['foss', 'tech'],
  },
  {
    url: 'https://tavern.antipope.info',
    weight: 0.5,
    label: 'Tavern',
    software: 'pleroma',
    topics: ['general', 'writing'],
  },
  // poa.st removed — 404
  // pleroma.site removed — timeout

  // ── Mastodon: Crypto / Web3 (EXPANDED 2026-08-06) ──────────────
  // NOTE: bitcoinhackers.org, cryptodon.social, defi.social,
  // ethresear.ch and bitcoin-chat.com were requested but verified
  // unreachable/not-Mastodon-API (DNS dead or 404 on /api/v1/instance).
  // ethresear.ch IS reachable via RSS and was added to the RSS feed
  // config instead. Verified reachable alternatives added below.
  {
    url: 'https://bitbang.social',
    weight: 0.7,
    label: 'BitBang',
    software: 'mastodon',
    topics: ['bitcoin', 'crypto', 'tech'],
  },

  // ── Mastodon: Tech / FOSS / Engineering (EXPANDED 2026-08-06) ──
  // User-requested fosstodon.org, hachyderm.io, infosec.exchange
  // already present above. floss.social verified; sysad.in and
  // discuss.tech were unreachable (no DNS) and skipped.
  {
    url: 'https://floss.social',
    weight: 0.8,
    label: 'FLOSS',
    software: 'mastodon',
    topics: ['foss', 'tech', 'linux'],
  },
  {
    url: 'https://wuffs.org',
    weight: 0.7,
    label: 'Wuffs',
    software: 'mastodon',
    topics: ['tech', 'dev'],
  },
  {
    url: 'https://mastodon.radio',
    weight: 0.7,
    label: 'Radio',
    software: 'mastodon',
    topics: ['tech', 'radio', 'ham'],
  },
  {
    url: 'https://hackaday.social',
    weight: 0.8,
    label: 'Hackaday',
    software: 'mastodon',
    topics: ['tech', 'hardware', 'hacking'],
  },
  {
    url: 'https://social.treehouse.systems',
    weight: 0.7,
    label: 'Treehouse',
    software: 'mastodon',
    topics: ['tech', 'dev', 'foss'],
  },
  {
    url: 'https://techpolicy.social',
    weight: 0.7,
    label: 'TechPolicy',
    software: 'mastodon',
    topics: ['tech', 'policy'],
  },
  {
    url: 'https://mstdn.io',
    weight: 0.7,
    label: 'MstdnIO',
    software: 'mastodon',
    topics: ['tech', 'general'],
  },
  {
    url: 'https://todon.eu',
    weight: 0.7,
    label: 'Todon',
    software: 'mastodon',
    topics: ['tech', 'foss', 'privacy'],
  },
  {
    url: 'https://social.edu.nl',
    weight: 0.6,
    label: 'EduNL',
    software: 'mastodon',
    topics: ['tech', 'academic'],
  },
  {
    url: 'https://digitalcourage.social',
    weight: 0.7,
    label: 'DigiCourage',
    software: 'mastodon',
    topics: ['privacy', 'tech'],
  },

  // ── Mastodon: Gaming (EXPANDED 2026-08-06) ──────────────────────
  // User-requested dice.camp, wandering.shop, tabletop.social
  // verified; boardgames.social was parked (no server) and skipped.
  {
    url: 'https://dice.camp',
    weight: 0.7,
    label: 'DiceCamp',
    software: 'mastodon',
    topics: ['gaming', 'ttrpg'],
  },
  {
    url: 'https://wandering.shop',
    weight: 0.7,
    label: 'Wandering',
    software: 'mastodon',
    topics: ['gaming', 'fiction', 'general'],
  },
  {
    url: 'https://tabletop.social',
    weight: 0.7,
    label: 'Tabletop',
    software: 'mastodon',
    topics: ['gaming', 'ttrpg'],
  },
  {
    url: 'https://mastodon.gamedev.place',
    weight: 0.8,
    label: 'GameDev',
    software: 'mastodon',
    topics: ['gaming', 'dev'],
  },
  {
    url: 'https://cyberfurz.social',
    weight: 0.6,
    label: 'CyberFurz',
    software: 'mastodon',
    topics: ['gaming', 'general'],
  },
  {
    url: 'https://meow.social',
    weight: 0.6,
    label: 'Meow',
    software: 'mastodon',
    topics: ['gaming', 'general'],
  },
  {
    url: 'https://woof.group',
    weight: 0.6,
    label: 'Woof',
    software: 'mastodon',
    topics: ['gaming', 'general'],
  },
  {
    url: 'https://toot.cat',
    weight: 0.6,
    label: 'TootCat',
    software: 'mastodon',
    topics: ['gaming', 'general'],
  },
  {
    url: 'https://sunny.garden',
    weight: 0.6,
    label: 'SunnyGarden',
    software: 'mastodon',
    topics: ['gaming', 'general'],
  },
  {
    url: 'https://beige.party',
    weight: 0.7,
    label: 'Beige',
    software: 'mastodon',
    topics: ['gaming', 'general'],
  },
  {
    url: 'https://kind.social',
    weight: 0.6,
    label: 'Kind',
    software: 'mastodon',
    topics: ['gaming', 'general'],
  },

  // ── Mastodon: Art / Design (EXPANDED 2026-08-06) ────────────────
  // mastodon.art already present above. vis.social, pixel.tchncs.de,
  // genart.social verified.
  {
    url: 'https://vis.social',
    weight: 0.6,
    label: 'VisSocial',
    software: 'mastodon',
    topics: ['art', 'data', 'visualization'],
  },
  {
    url: 'https://pixel.tchncs.de',
    weight: 0.6,
    label: 'PixelTchncs',
    software: 'mastodon',
    topics: ['art', 'pixel', 'creative'],
  },
  {
    url: 'https://genart.social',
    weight: 0.6,
    label: 'GenArt',
    software: 'mastodon',
    topics: ['art', 'generative', 'creative'],
  },
  {
    url: 'https://mastodon.gal',
    weight: 0.5,
    label: 'Gal',
    software: 'mastodon',
    topics: ['art', 'culture', 'general'],
  },

  // ── Mastodon: Music (EXPANDED 2026-08-06) ───────────────────────
  // bandwagon.fm, metalhead.club, ravenation.club verified.
  {
    url: 'https://bandwagon.fm',
    weight: 0.6,
    label: 'Bandwagon',
    software: 'mastodon',
    topics: ['music', 'general'],
  },
  {
    url: 'https://metalhead.club',
    weight: 0.6,
    label: 'Metalhead',
    software: 'mastodon',
    topics: ['music', 'metal'],
  },
  {
    url: 'https://ravenation.club',
    weight: 0.6,
    label: 'RaveNation',
    software: 'mastodon',
    topics: ['music', 'general'],
  },

  // ── Mastodon: News / Media (EXPANDED 2026-08-06) ────────────────
  // journa.host, newsie.social verified; press.coop was unreachable
  // (no DNS) and skipped.
  {
    url: 'https://journa.host',
    weight: 0.8,
    label: 'JournaHost',
    software: 'mastodon',
    topics: ['news', 'journalism'],
  },
  {
    url: 'https://newsie.social',
    weight: 0.8,
    label: 'Newsie',
    software: 'mastodon',
    topics: ['news', 'journalism'],
  },

  // ── Mastodon: Science / Climate (EXPANDED 2026-08-06) ───────────
  {
    url: 'https://fediscience.org',
    weight: 0.7,
    label: 'FediScience',
    software: 'mastodon',
    topics: ['science', 'academic'],
  },
  {
    url: 'https://zirk.us',
    weight: 0.7,
    label: 'Zirk',
    software: 'mastodon',
    topics: ['science', 'academic'],
  },
  {
    url: 'https://mastodon.green',
    weight: 0.7,
    label: 'Green',
    software: 'mastodon',
    topics: ['climate', 'science'],
  },
  {
    url: 'https://climatejustice.social',
    weight: 0.6,
    label: 'ClimateJustice',
    software: 'mastodon',
    topics: ['climate', 'science'],
  },

  // ── Mastodon: General / Large (EXPANDED 2026-08-06) ─────────────
  // User-requested mastodon.social, mstdn.social, mas.to, c.im,
  // universeodon.com, mastodon.world, mastodon.online already present.
  // aus.social verified.
  {
    url: 'https://aus.social',
    weight: 0.7,
    label: 'AusSocial',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://sfba.social',
    weight: 0.7,
    label: 'SFBA',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.top',
    weight: 0.6,
    label: 'Top',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://lounge.town',
    weight: 0.6,
    label: 'LoungeTown',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mementomori.social',
    weight: 0.6,
    label: 'MementoMori',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.bot',
    weight: 0.5,
    label: 'MastodonBot',
    software: 'mastodon',
    topics: ['general', 'bots'],
  },
  {
    url: 'https://fandom.ink',
    weight: 0.6,
    label: 'FandomInk',
    software: 'mastodon',
    topics: ['general', 'popculture'],
  },
  {
    url: 'https://mastodon.la',
    weight: 0.6,
    label: 'MastodonLA',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://toot.wales',
    weight: 0.6,
    label: 'TootWales',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://disabled.social',
    weight: 0.6,
    label: 'Disabled',
    software: 'mastodon',
    topics: ['general', 'disability'],
  },
  {
    url: 'https://wetdry.world',
    weight: 0.5,
    label: 'WetDry',
    software: 'mastodon',
    topics: ['general', 'memes'],
  },
  {
    url: 'https://mastodon.sdf.org',
    weight: 0.7,
    label: 'SDF',
    software: 'mastodon',
    topics: ['general', 'tech'],
  },
  {
    url: 'https://macaw.social',
    weight: 0.6,
    label: 'Macaw',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://chaos.social',
    weight: 0.7,
    label: 'Chaos',
    software: 'mastodon',
    topics: ['tech', 'general'],
  },
  {
    url: 'https://assemblag.es',
    weight: 0.6,
    label: 'Assemblag',
    software: 'mastodon',
    topics: ['general', 'tech'],
  },
  {
    url: 'https://circumstances.run',
    weight: 0.5,
    label: 'Circumstances',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://me.dm',
    weight: 0.6,
    label: 'MeDotDM',
    software: 'mastodon',
    topics: ['general', 'tech'],
  },

  // ── Mastodon: International (EXPANDED 2026-08-06) ────────────────
  // Regional instances verified reachable — broadens the geographic
  // diversity of the fediverse feed so users always have fresh content.
  {
    url: 'https://mastodonapp.uk',
    weight: 0.6,
    label: 'AppUK',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.design',
    weight: 0.6,
    label: 'Design',
    software: 'mastodon',
    topics: ['design', 'art'],
  },
  {
    url: 'https://mastodon.xyz',
    weight: 0.6,
    label: 'XYZ',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.nl',
    weight: 0.6,
    label: 'NL',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.ie',
    weight: 0.6,
    label: 'IE',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.de',
    weight: 0.6,
    label: 'DE',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.uno',
    weight: 0.6,
    label: 'Uno',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.bida.im',
    weight: 0.5,
    label: 'Bida',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mstdn.ca',
    weight: 0.7,
    label: 'MstdnCA',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.nz',
    weight: 0.6,
    label: 'NZ',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.org.uk',
    weight: 0.6,
    label: 'OrgUK',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.me.uk',
    weight: 0.6,
    label: 'MeUK',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.coffee',
    weight: 0.5,
    label: 'Coffee',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.berlin',
    weight: 0.6,
    label: 'Berlin',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://muenchen.social',
    weight: 0.6,
    label: 'Muenchen',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://norden.social',
    weight: 0.6,
    label: 'Norden',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://ruhr.social',
    weight: 0.6,
    label: 'Ruhr',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://freiburg.social',
    weight: 0.6,
    label: 'Freiburg',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://swiss.social',
    weight: 0.6,
    label: 'Swiss',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.fr',
    weight: 0.6,
    label: 'FR',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.dk',
    weight: 0.6,
    label: 'DK',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.com.tr',
    weight: 0.6,
    label: 'TR',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.tn',
    weight: 0.5,
    label: 'TN',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.hr',
    weight: 0.5,
    label: 'HR',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.rs',
    weight: 0.5,
    label: 'RS',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.sk',
    weight: 0.5,
    label: 'SK',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.my',
    weight: 0.5,
    label: 'MY',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.ph',
    weight: 0.5,
    label: 'PH',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.vn',
    weight: 0.5,
    label: 'VN',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.fo',
    weight: 0.5,
    label: 'FO',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.im',
    weight: 0.5,
    label: 'IM',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.li',
    weight: 0.5,
    label: 'LI',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.lu',
    weight: 0.5,
    label: 'LU',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.sg',
    weight: 0.6,
    label: 'SG',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.ee',
    weight: 0.5,
    label: 'EE',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.be',
    weight: 0.5,
    label: 'BE',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mstdn.jp',
    weight: 0.7,
    label: 'MstdnJP',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.tokyo',
    weight: 0.6,
    label: 'Tokyo',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.africa',
    weight: 0.5,
    label: 'Africa',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.mx',
    weight: 0.6,
    label: 'MX',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.cl',
    weight: 0.5,
    label: 'CL',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.cr',
    weight: 0.5,
    label: 'CR',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.uy',
    weight: 0.5,
    label: 'UY',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.eus',
    weight: 0.5,
    label: 'Eus',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodont.cat',
    weight: 0.5,
    label: 'Cat',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://sciences.social',
    weight: 0.7,
    label: 'Sciences',
    software: 'mastodon',
    topics: ['science', 'academic'],
  },
];

/**
 * Flat list of fediverse instance URLs for fallback / public timeline
 * fetching. Auto-generated from TRENDING_INSTANCES (all 150+ verified
 * instances) plus a small set of niche instances that lack a trending
 * API but are still good public-timeline content sources.
 * Deduplicated so every URL appears exactly once.
 */
export const PUBLIC_MASTODON_INSTANCES: string[] = [
  ...TRENDING_INSTANCES.map((i) => i.url),
  // Additional instances (no trending API, good for public timeline)
  // mastodon.se kept for backwards compatibility (may be down).
  'https://mastodon.se',
];

// ─── Fediverse content relevance scoring ─────────────────────────────
// Posts are scored 0-1 for crypto/tech/web3 relevance. Low-scoring
// posts (personal updates, random memes, non-crypto/non-tech) are
// filtered out to keep the feed focused.

export const CRYPTO_KEYWORDS = [
  'bitcoin',
  'btc',
  'ethereum',
  'eth',
  'solana',
  'sol',
  'crypto',
  'cryptocurrency',
  'blockchain',
  'web3',
  'defi',
  'nft',
  'altcoin',
  'token',
  'coin',
  'mining',
  'halving',
  'lightning',
  'ordinal',
  'brc-20',
  'rune',
  'stablecoin',
  'usdc',
  'usdt',
  'dai',
  'dex',
  'amm',
  'liquidity',
  'yield',
  'staking',
  'restaking',
  'layer2',
  'rollup',
  'zk',
  'zero knowledge',
  'arbitrum',
  'optimism',
  'base',
  'polygon',
  'solana',
  'avalanche',
  'cosmos',
  'polkadot',
  'cardano',
  'memecoin',
  'pepe',
  'dogecoin',
  'shiba',
  'bonk',
  'wif',
  'jupiter',
  'raydium',
  'orca',
  'phantom',
  'metamask',
  'sec',
  'cftc',
  'regulation',
  'etf',
  'bitcoin etf',
  'ethereum etf',
  'macro',
  'federal reserve',
  'fed',
  'inflation',
  'interest rate',
  'onchain',
  'wallet',
  'smart contract',
  'dapp',
  'blink',
  'solana pay',
  'tip',
  'micropayment',
];

export const TECH_KEYWORDS = [
  'ai',
  'artificial intelligence',
  'machine learning',
  'llm',
  'gpt',
  'openai',
  'claude',
  'gemini',
  'deepseek',
  'neural',
  'transformer',
  'copilot',
  'diffusion',
  'agent',
  'rag',
  'fine tuning',
  'programming',
  'coding',
  'software',
  'developer',
  'devops',
  'linux',
  'opensource',
  'foss',
  'selfhosted',
  'rust',
  'golang',
  'python',
  'typescript',
  'javascript',
  'privacy',
  'security',
  'infosec',
  'cybersecurity',
  'hacking',
  'penetration testing',
  'vulnerability',
  'cloud',
  'kubernetes',
  'docker',
  'aws',
  'infrastructure',
  'data science',
  'analytics',
  'database',
  'api',
  'startup',
  'saas',
  'product',
  'engineering',
];

export const CRYPTO_HASHTAGS = [
  'bitcoin',
  'btc',
  'ethereum',
  'eth',
  'solana',
  'sol',
  'crypto',
  'cryptocurrency',
  'blockchain',
  'web3',
  'defi',
  'nft',
  'altcoin',
  'memecoin',
  'bitcoinetf',
  'ethetf',
  'halving',
  'layer2',
  'rollup',
  'zksync',
  'arbitrum',
  'optimism',
  'base',
  'ordinals',
  'brc20',
  'runes',
  'stablecoin',
  'lightning',
  'lightningnetwork',
  'jupiter',
  'raydium',
  'phantom',
  'cryptotrading',
  'cryptomarkets',
  'token2049',
  'consensus',
];

export const TECH_HASHTAGS = [
  'ai',
  'artificialintelligence',
  'machinelearning',
  'llm',
  'openai',
  'chatgpt',
  'claude',
  'deepseek',
  'gemini',
  'programming',
  'coding',
  'softwareengineering',
  'linux',
  'opensource',
  'foss',
  'selfhosted',
  'rust',
  'golang',
  'python',
  'typescript',
  'javascript',
  'react',
  'vue',
  'nodejs',
  'webdev',
  'privacy',
  'security',
  'infosec',
  'cybersecurity',
  'hacking',
  'infosec',
  'penetrationtesting',
  'cloud',
  'kubernetes',
  'docker',
  'devops',
  'datascience',
  'machinelearning',
  'startup',
  'tech',
  'innovation',
];

export const FEDIVERSE_KEYWORDS = [
  'fediverse',
  'activitypub',
  'mastodon',
  'pleroma',
  'misskey',
  'firefish',
  'lemmy',
  'peertube',
];

/**
 * Score a post's content for crypto/tech/web3 relevance.
 * Returns 0-1 where >= RELEVANCE_THRESHOLD is considered on-topic.
 */
export function scoreFediverseRelevance(text: string, tags: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;

  // Strong signals: exact matches in crypto keywords
  for (const kw of CRYPTO_KEYWORDS) {
    if (lower.includes(kw)) {
      score += 0.15;
    }
  }

  // Strong signals: tech keywords
  for (const kw of TECH_KEYWORDS) {
    if (lower.includes(kw)) {
      score += 0.1;
    }
  }

  // Tag matches (very strong signal — user opted into these tags)
  for (const tag of tags) {
    const lowerTag = tag.toLowerCase();
    if (CRYPTO_HASHTAGS.includes(lowerTag)) score += 0.25;
    else if (TECH_HASHTAGS.includes(lowerTag)) score += 0.2;
    else if (FEDIVERSE_KEYWORDS.includes(lowerTag)) score += 0.15;
  }

  // Fediverse software discussion
  if (lower.includes('fediverse') || lower.includes('activitypub')) score += 0.1;

  // Negative signals: completely off-topic personal content
  if (
    /^\s*(happy|good morning|good night|i (just|love|hate|need|want|feel)|my (dog|cat|kid|mom|dad|wife|husband))/.test(
      lower,
    )
  ) {
    score -= 0.4;
  }

  return Math.max(0, Math.min(1, score));
}

/** Minimum relevance score for a post to appear in the feed. */
export const RELEVANCE_THRESHOLD = 0.25;
