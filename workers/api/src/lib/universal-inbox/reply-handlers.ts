/**
 * @degenfeed/api-worker — Universal Inbox Protocol Reply Handlers
 *
 * Send replies to any protocol. Each function handles the
 * protocol-specific API call to post a reply.
 */

export async function replyMastodon(
  content: string, parentId: string, auth: Record<string, string>, _env: unknown,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {

export async function replyNostr(
  content: string, parentEventId: string, auth: Record<string, string>, signedMessage?: string,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {

export async function replyFarcaster(
  _content: string, auth: Record<string, string>, signedMessage?: string,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {

export async function replyBluesky(
  content: string, auth: Record<string, string>,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {

export async function replyPeerTube(
  content: string, _nativeId: string, auth: Record<string, string>, parentVideoUuid?: string,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {

export async function replyLemmy(
  content: string, parentPostId: string, auth: Record<string, string>,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {

export async function replyPixelfed(
  content: string, parentStatusId: string, auth: Record<string, string>,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {

export async function replyMatrix(
  content: string, auth: Record<string, string>,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {

