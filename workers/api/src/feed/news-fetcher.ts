export interface ParsedRssItem {

function decodeXmlEntities(str: string): string {

export function stripTags(html: string): string {

function extractText(tag: string, xml: string): string {

function extractAll(tag: string, xml: string): string[] {

interface ParsedRssItem {

function _parseFeedXml(xml: string, maxItems = 20): ParsedRssItem[] {

function parseAtom(xml: string, maxItems = 20): ParsedRssItem[] {

async function _fetchRssFeed(url: string, timeoutMs = 8000): Promise<string | null> {

export interface ArticleEnrichment {

/**
 * Estimate reading time from word count.
 */
function _estimateReadingTime(text: string): number {

/**
async function enrichArticle(url: string, timeoutMs = 3000): Promise<ArticleEnrichment> {

// ─── Protocol Source Fetching ──────────────────────────────────────────

async function _fetchProtocolSources(
  env: Env,
): Promise<Array<{ item: ParsedRssItem; source: NewsSourceMeta }>> {

// ─── Concurrency Limit Helper ──────────────────────────────────────────

async function _withConcurrencyLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {

