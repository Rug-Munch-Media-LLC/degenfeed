/**
 * New article alert template — sent when a creator publishes a new article.
 */

import type { NewArticleTemplateParams } from './types';
import { emailDocument } from './types';

export function renderNewArticleHtml(params: NewArticleTemplateParams): string {

