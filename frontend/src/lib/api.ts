export const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export async function uploadBatch(files: File[], cutClips = true): Promise<{ jobs: string[] }> {
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  fd.append("cut_clips", String(cutClips));
  const res = await fetch(`${API_BASE}/api/jobs/upload`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getJob(jobId: string) {
  const res = await fetch(`${API_BASE}/api/jobs/${jobId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listJobs() {
  const res = await fetch(`${API_BASE}/api/jobs`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function startJobs(recordingIds: string[], cutClips = true, asrStreaming?: boolean, glossaryLang: 'zh' | 'ja' = 'zh'): Promise<{ jobs: string[] }> {
  const res = await fetch(`${API_BASE}/api/jobs/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recording_ids: recordingIds,
      cut_clips: cutClips,
      asr_streaming: asrStreaming,
      glossary_lang: glossaryLang
    })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteRecording(id: string, cascade = false): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/api/recordings/${id}?cascade=${cascade ? 'true' : 'false'}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteJob(jobId: string, purge = true): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/api/jobs/${jobId}?purge=${purge ? 'true' : 'false'}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Merge API: course-only outputs
export interface SegmentEditUpdate {
  segment_id: number;
  transcript?: string;
  label?: string;
}

export interface MergeCourseResponse {
  video_url?: string | null;
  subtitle_url?: string | null;
  subtitle_urls?: { srt?: string; vtt?: string; json?: string } | null;
  kept_segments: number;
  total_duration: number;
  mapping: Array<{ segment_id: number; old_start: number; old_end: number; new_start: number; new_end: number }>;
}

export async function mergeCourse(
  jobId: string,
  updates: SegmentEditUpdate[],
  makeVideo = true,
  makeSubtitle = true
): Promise<MergeCourseResponse> {
  const res = await fetch(`${API_BASE}/api/jobs/${jobId}/merge/course`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates, make_video: makeVideo, make_subtitle: makeSubtitle }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Glossary API
export interface GlossaryInfo {
  filename: string | null;
  upload_time: string | null;
  entry_count: number;
}

export async function uploadGlossary(file: File, lang: 'zh' | 'ja' = 'zh'): Promise<{ success: boolean; stats: GlossaryInfo }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/api/glossary/upload?lang=${lang}`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getGlossaryInfo(lang: 'zh' | 'ja' = 'zh'): Promise<{ success: boolean; glossary: GlossaryInfo }> {
  const res = await fetch(`${API_BASE}/api/glossary/info?lang=${lang}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getGlossaryWords(lang: 'zh' | 'ja' = 'zh'): Promise<{ success: boolean; words: string[]; count: number }> {
  const res = await fetch(`${API_BASE}/api/glossary/words?lang=${lang}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function addGlossaryWord(word: string, lang: 'zh' | 'ja' = 'zh'): Promise<{ success: boolean; word: string; total_count: number }> {
  const res = await fetch(`${API_BASE}/api/glossary/words?lang=${lang}&word=${encodeURIComponent(word)}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteGlossaryWord(word: string, lang: 'zh' | 'ja' = 'zh'): Promise<{ success: boolean; word: string; total_count: number }> {
  const res = await fetch(`${API_BASE}/api/glossary/words/${encodeURIComponent(word)}?lang=${lang}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteAllGlossaryWords(lang: 'zh' | 'ja' = 'zh'): Promise<{ success: boolean; message: string; deleted_count: number }> {
  const res = await fetch(`${API_BASE}/api/glossary/words?lang=${lang}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Parse API - for PDF parsing and OMIP data
export interface ParseRunResult {
  run: {
    id: string;
    paper_id: string;
    batch_id: string | null;
    status: string;
    task_state: string | null;
    error_msg: string | null;
    created_at: string | null;
    result: {
      omip_id: string | null;
      title: string | null;
      authors: string[];
      year: number | null;
      tables: number;
      figures: number;
    };
  };
  paper: {
    id: string;
    filename: string;
    file_hash: string;
    source_pdf: string;
    created_at: string | null;
  };
  metadata: any;
  elements: Array<{
    id: string;
    type: string;
    label: string | null;
    caption: string | null;
    content: any;
    order_index: number;
  }>;
}

export async function getParseRun(runId: string): Promise<ParseRunResult> {
  const res = await fetch(`${API_BASE}/api/runs/${runId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getParseRunsCount(status?: string, task_state?: string): Promise<number> {
  const params = new URLSearchParams();
  if (status) params.append("status", status);
  if (task_state) params.append("task_state", task_state);

  const res = await fetch(`${API_BASE}/api/runs/count?${params.toString()}`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.count;
}

export async function listParseRuns(
  page: number = 1,
  pageSize: number = 10,
  status?: string,
  task_state?: string
): Promise<any[]> {
  const offset = (page - 1) * pageSize;
  const params = new URLSearchParams();
  params.append("limit", String(pageSize));
  params.append("offset", String(offset));
  if (status) params.append("status", status);
  if (task_state) params.append("task_state", task_state);

  const res = await fetch(`${API_BASE}/api/runs?${params.toString()}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateParseMetadata(runId: string, metadata: any): Promise<any> {
  const res = await fetch(`${API_BASE}/api/runs/${runId}/metadata`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `Failed to update metadata: ${res.status}`);
  }
  return res.json();
}

export interface MetadataVersion {
  id: string;
  run_id: string;
  omip_id: string | null;
  title: string | null;
  authors: string[] | null;
  year: number | null;
  created_at: string | null;
}

export async function getRunVersions(runId: string): Promise<MetadataVersion[]> {
  const res = await fetch(`${API_BASE}/api/runs/${runId}/versions`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getRunVersionContent(runId: string, versionId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/runs/${runId}/versions/${versionId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function retryRun(runId: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/runs/${runId}/retry`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function retryAllFailed(): Promise<{ success: boolean; retried_count: number }> {
  const res = await fetch(`${API_BASE}/api/runs/retry-failed`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
