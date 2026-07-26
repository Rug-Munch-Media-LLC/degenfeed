/**
 * Video platform provider implementations.
 * Each provider implements VideoPlatformWrapper for a specific video source.
 * All providers are registered on module load.
 */

export {

import { registerWrapper } from './constants';
import {

registerWrapper(farcasterPlatformWrapper);
registerWrapper(zoraPlatformWrapper);
registerWrapper(lensPlatformWrapper);
registerWrapper(nostrPlatformWrapper);
registerWrapper(dtubePlatformWrapper);
registerWrapper(odyseePlatformWrapper);
registerWrapper(rumblePlatformWrapper);
registerWrapper(bittubePlatformWrapper);

