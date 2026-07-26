/**
 * /api/feed/rss.xml — Publishes a proper RSS 2.0 + Atom 1.0 feed of the
 * aggregated, ranked, de-spammed DegenFeed home feed.
 *
 * Anyone can subscribe to this with a podcast reader, Feedly, NetNewsWire,
 * Inoreader, etc. and get the top web3 stories without visiting the site.
 *
 * Query params:
 *   category — optional niche filter
 *   limit    — max items (default 50, cap 200)
 *   q        — free-text query filter
 */

import {
