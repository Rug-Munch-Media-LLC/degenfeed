/**
 * Newsletter email template — full article newsletter sent to subscribers.
 */

import type { NewsletterTemplateParams } from './types';
import { emailDocument } from './types';

export function renderNewsletterHtml(params: NewsletterTemplateParams): string {

