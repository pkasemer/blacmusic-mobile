import type { BlacApi } from './api';
import { USES_BACKEND } from './config';
import { httpApi } from './httpApi';
import { mockApi } from './mockApi';

/**
 * The API the app uses: the Blac backend when a server address is known (see `config.ts`), otherwise
 * the built-in sample data.
 */
export const blacApi: BlacApi = USES_BACKEND ? httpApi : mockApi;
export { authApi } from './auth';
export { API_URL, USES_BACKEND } from './config';
export { ApiError } from './http';
export type { BlacApi, CreateArtistInput, DownloadInfo, PlaybackLink, StreamQuality } from './api';
