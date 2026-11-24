import { create } from 'zustand';

export type UploadJobState = 'waiting' | 'uploading' | 'processing' | 'ready' | 'failed';

/** One track being uploaded from this phone. Lives only while the app is open. */
export interface UploadJob {
  key: string;
  releaseId: string;
  /** The backend's id for this upload, once it has been created. */
  uploadId: string | null;
  title: string;
  filename: string;
  sizeBytes: number;
  state: UploadJobState;
  /** 0 to 1 of the file sent. */
  progress: number;
  error: string | null;
}

interface UploadState {
  jobs: Record<string, UploadJob>;
  add: (job: UploadJob) => void;
  patch: (key: string, patch: Partial<UploadJob>) => void;
  remove: (key: string) => void;
}

export const useUploadStore = create<UploadState>()((set) => ({
  jobs: {},
  add: (job) => set((s) => ({ jobs: { ...s.jobs, [job.key]: job } })),
  patch: (key, patch) =>
    set((s) => (s.jobs[key] ? { jobs: { ...s.jobs, [key]: { ...s.jobs[key], ...patch } } } : s)),
  remove: (key) =>
    set((s) => {
      const { [key]: _removed, ...rest } = s.jobs;
      return { jobs: rest };
    }),
}));

/** Jobs of one release, oldest first. */
export const selectJobsFor = (releaseId: string) => (s: UploadState) =>
  Object.values(s.jobs).filter((j) => j.releaseId === releaseId);
