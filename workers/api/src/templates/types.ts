/**
 * Email template parameter types for DegenFeed newsletter system.
 */

export interface NewsletterTemplateParams {

export interface WelcomeTemplateParams {

export interface ReceiptTemplateParams {

export interface NewArticleTemplateParams {

/**
 * Wraps an HTML body in a full email document with shared styles.
 */
export function emailDocument(bodyHtml: string, preheader?: string): string {

