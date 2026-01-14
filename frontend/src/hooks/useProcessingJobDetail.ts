import { useState, useEffect } from "react";
// Supabase removed: use backend API only
import { useAuth } from "./useAuth";

export interface ProcessingSegment {
  segment_id: number;
  start_time: number;
  end_time: number;
  duration: number;
  transcript: string;
  classification: string;
}

export interface ProcessingResult {
  segments: ProcessingSegment[];
  statistics: {
    total_segments: number;
    笑話雜談: number;
    正課內容: number;
    無法分類: number;
  };
}

export interface ProcessingJobDetail {
  id: string;
  user_id: string;
  recording_id: string;
  task_id: string;
  status: string;
  progress: number;
  total_segments: number | null;
  processed_segments: number | null;
  result: ProcessingResult | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  recording: {
    id: string;
    name: string;
    file_path: string;
    file_size: number;
    duration: string | null;
    created_at: string;
  } | null;
}

export function useProcessingJobDetail(jobId: string | undefined) {
  const { user } = useAuth();
  const [job, setJob] = useState<ProcessingJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) { setLoading(false); return; }

    let alive = true;
    const fetchJob = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (!alive) return;
        const result = data.result || {};
        const segsRaw = (result.segments || []) as any[];
        const segments: ProcessingSegment[] = segsRaw.map((s, idx) => ({
          segment_id: s.segment_id ?? idx + 1,
          start_time: s.start_time,
          end_time: s.end_time,
          transcript: s.transcript || '',
          classification: (s.label || '').includes('Jokes') ? '笑話雜談' : '正課內容',
          duration: s.end_time - s.start_time,
        }));
        const mapped: ProcessingJobDetail = {
          id: data.id,
          user_id: '',
          recording_id: '',
          task_id: data.id,
          status: data.status,
          progress: data.meta?.progress ?? 0,
          total_segments: segments.length,
          processed_segments: segments.length,
          result: { segments, statistics: {} as any },
          error: data.error || null,
          created_at: data.enqueued_at || new Date().toISOString(),
          updated_at: data.ended_at || data.started_at || data.enqueued_at || new Date().toISOString(),
          recording: { id: '', name: data.meta?.filename || '未命名', file_path: '', file_size: 0, duration: null, created_at: '' },
        };
        setJob(mapped);
        // Video URL if clips present
        const clip = (result.clips || [])[0];
        if (clip?.file) setVideoUrl(clip.file);
      } catch (err) {
        if (!alive) return;
        console.error('Error fetching job:', err);
        setError(err instanceof Error ? err.message : '載入失敗');
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchJob();
    const t = setInterval(fetchJob, 1500);
    return () => { alive = false; clearInterval(t); };
  }, [jobId]);

  return { job, loading, error, videoUrl };
}
