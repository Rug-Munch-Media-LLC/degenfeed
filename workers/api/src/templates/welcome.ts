/**
 * Welcome email template — sent when a user subscribes to a creator.
 */

import type { WelcomeTemplateParams } from './types';
import { emailDocument } from './types';

export function renderWelcomeHtml(params: WelcomeTemplateParams): string {

