/**
 * Video platform provider implementations.
 * Each provider implements VideoPlatformWrapper for a specific video source.
 * All providers are registered on module load.
 */

export {
  farcasterPlatformWrapper,
  zoraPlatformWrapper,
  lensPlatformWrapper,
  nostrPlatformWrapper,
  dtubePlatformWrapper,
  odyseePlatformWrapper,
  rumblePlatformWrapper,
  bittubePlatformWrapper,
} from './implementation';

import { registerWrapper } from './constants';
import {
  farcasterPlatformWrapper,
  zoraPlatformWrapper,
  lensPlatformWrapper,
  nostrPlatformWrapper,
  dtubePlatformWrapper,
  odyseePlatformWrapper,
  rumblePlatformWrapper,
  bittubePlatformWrapper,
} from './implementation';

registerWrapper(farcasterPlatformWrapper);
registerWrapper(zoraPlatformWrapper);
registerWrapper(lensPlatformWrapper);
registerWrapper(nostrPlatformWrapper);
registerWrapper(dtubePlatformWrapper);
registerWrapper(odyseePlatformWrapper);
registerWrapper(rumblePlatformWrapper);
registerWrapper(bittubePlatformWrapper);
