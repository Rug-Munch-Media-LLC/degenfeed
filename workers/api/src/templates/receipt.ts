/**
 * Payment receipt template — sent on successful paid subscription.
 */

import type { ReceiptTemplateParams } from './types';
import { emailDocument } from './types';

export function renderReceiptHtml(params: ReceiptTemplateParams): string {

