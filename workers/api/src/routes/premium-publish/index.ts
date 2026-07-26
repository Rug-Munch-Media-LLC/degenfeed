/**
 * @degenfeed/api-worker — Premium Publishing barrel
 *
 * Exports all premium publish handlers:
 * - Queue management (add, list, update, delete, stats)
 * - Calendar view
 * - Batch publish
 * - AI optimization (best times, recycle, evergreen, recurring)
 * - Cross-platform composer (Buffer-style)
 * - Post engagement analytics (queue-specific)
 * - Cron executor
 */

export {
  handleGetPostPerformance,
  handleListPostAnalytics,
  handleRecordEngagement,
} from './analytics';
export {
  handleComposerPost,
  handleComposerPreview,
  handleComposerProtocols,
} from './composer';
export {
  handleBestTimes,
  handleRecyclePost,
  handleSetEvergreen,
  handleSetRecurring,
} from './optimize';
export {
  executeDuePremiumPosts,
  handleBatchPublish,
  handleCalendarView,
  handleQueueAdd,
  handleQueueDelete,
  handleQueueList,
  handleQueueStats,
  handleQueueUpdate,
} from './queue';
export * from './types';
