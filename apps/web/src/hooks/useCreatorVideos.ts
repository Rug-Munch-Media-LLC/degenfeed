/**
 * Creator Video hooks.
 *
 * Re-exports the creator video hooks from the component-level implementation.
 */

export type {
  CreatorVideoMeta,
  UploadResult,
  UploadVideoInput,
  VideoAnalytics,
  VideoDetailResponse,
  VideosResponse,
} from '../components/creator/useCreatorVideos';
export {
  useCreatorVideo,
  useCreatorVideoActions,
  useCreatorVideos,
} from '../components/creator/useCreatorVideos';
