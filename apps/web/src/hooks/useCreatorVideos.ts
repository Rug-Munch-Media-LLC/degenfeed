/**
 * Creator Video hooks.
 *
 * Central exports for managing creator video content:
 * listing, uploading, editing, deleting, analytics, and cross-platform publishing.
 *
 * All hooks are re-exported from the component-level implementation
 * for convenient access from both pages and components.
 */
export {
  useCreatorVideos,
  useCreatorVideo,
  useCreatorVideoActions,
  useVideoAnalytics,
  useCrossPublish,
  useVideoDelete,
} from '../components/creator/useCreatorVideos';

export type {
  UploadVideoInput,
  UploadResult,
  VideosResponse,
  VideoDetailResponse,
  AnalyticsResponse,
  PublishTarget,
  PublishResponse,
  CrossPublishInput,
} from '../components/creator/useCreatorVideos';
