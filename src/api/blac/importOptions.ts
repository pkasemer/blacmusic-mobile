import { useQuery } from '@tanstack/react-query';
import { USES_BACKEND } from './config';
import { ApiError, apiRequest } from './http';

/**
 * The ways an artist can bring songs onto Blac. The backend says which are switched on, so options can be added or
 * turned off without a new app. Only the ones this app knows how to open are usable; others show as unavailable.
 */

export interface ImportOption {
  id: string;
  enabled: boolean;
  /** The backend's own wording, when it sends any. The app has its own for the options it knows. */
  title?: string;
  description?: string;
  /** Short text for an option that is off, such as "Coming soon". */
  note?: string;
}

/** What to show when the server cannot be asked (or is older than this app and has no list yet). */
export const DEFAULT_IMPORT_OPTIONS: ImportOption[] = [{ id: 'manual', enabled: true }];

async function getImportOptions(): Promise<ImportOption[]> {
  if (!USES_BACKEND) return DEFAULT_IMPORT_OPTIONS;
  try {
    const data = await apiRequest<{ options?: ImportOption[] }>('/v1/import-options');
    // YouTube import is no longer offered, whatever the server lists.
    const list = (data.options ?? []).filter((o) => o.id !== 'youtube');
    return list.length > 0 ? list : DEFAULT_IMPORT_OPTIONS;
  } catch (e) {
    // A server without the list yet answers 404 or 405: use the defaults. Anything else (offline) is an error to show.
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) return DEFAULT_IMPORT_OPTIONS;
    throw e;
  }
}

export const useImportOptions = () =>
  useQuery({ queryKey: ['import', 'options'], queryFn: getImportOptions, retry: 1, staleTime: 60_000 });
