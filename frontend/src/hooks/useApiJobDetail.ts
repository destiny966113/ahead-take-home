import { useEffect, useRef, useState } from "react";
import { getJob } from "@/lib/api";

interface Segment {
  segment_id: number;
  start_time: number;
  end_time: number;
  transcript: string;
  transcript_marked?: string;
  classification: string; // zh
  duration?: number;
}

export interface JobDetail {
  id: string;
  task_id: string;
  status: string; // zh
  progress: number;
  created_at: string;
  recording?: { name: string; duration?: string | null };
  recordingId?: string | null;
  result: { segments: Segment[]; statistics?: any; clips?: any[] };
  error?: string | null;
}

function zhLabel(label?: string) {
  if (!label) return "未分類";
  if (label.includes("Course")) return "正課內容";
  if (label.includes("Jokes")) return "笑話雜談";
  return label;
}

function zhStatus(status: string) {
  switch (status) {
    case "queued":
      return "排隊中";
    case "started":
      return "處理中";
    case "finished":
      return "已完成";
    case "failed":
      return "失敗";
    default:
      return status;
  }
}

export function useApiJobDetail(id: string | undefined) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const pollRef = useRef<any>(null);
  const firstLoadRef = useRef(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let mounted = true;

    async function fetchJob() {
      try {
        if (firstLoadRef.current) setLoading(true);
        const data = await getJob(id);
        if (!mounted) return;
        const result = data.result || {};
        const segsRaw = (result.segments || []) as any[];
        const segments: Segment[] = segsRaw.map((s, idx) => ({
          segment_id: s.segment_id ?? idx + 1,
          start_time: s.start_time,
          end_time: s.end_time,
          transcript: s.transcript || "",
          transcript_marked: s.transcript_marked || undefined,
          classification: zhLabel(s.label || s.classification),
          duration: s.end_time - s.start_time,
        }));
        const stats = {
          正課內容: segments.filter((s) => s.classification === "正課內容").length,
          笑話雜談: segments.filter((s) => s.classification === "笑話雜談").length,
        };
        const mapped: JobDetail = {
          id: data.id,
          task_id: data.id,
          status: zhStatus(data.status),
          progress: data.meta?.progress ?? (data.status === 'finished' ? 100 : 0),
          created_at: data.enqueued_at || new Date().toISOString(),
          recording: { name: data.meta?.filename || '未命名' },
          recordingId: data.recording_id || null,
          result: { segments, statistics: stats, clips: result.clips || [] },
          error: data.error || null,
        };
        setJob(mapped);
        console.info(`[api] job ${id}: status=${mapped.status} progress=${mapped.progress}`)
        // Prefer original uploaded video under /uploads/<basename>
        try {
          const input = (result && (result as any).input) || null;
          const filePath: string | undefined = input?.file_path || undefined;
          if (filePath) {
            const base = filePath.split('/').pop();
            if (base) {
              const url = `/uploads/${base}`;
              if (url !== videoUrl) setVideoUrl(url);
            }
          } else {
            // Fallback to first generated clip if original not available
            const clip = (result.clips || [])[0];
            if (clip?.file && clip.file !== videoUrl) setVideoUrl(clip.file);
          }
        } catch (e) {
          // Fallback on any error
          const clip = (result.clips || [])[0];
          if (clip?.file && clip.file !== videoUrl) setVideoUrl(clip.file);
        }
        if (mapped.status === '已完成' || mapped.status === '失敗') {
          // stop polling when terminal
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "載入失敗");
      } finally {
        if (mounted) setLoading(false);
        firstLoadRef.current = false;
      }
    }

    fetchJob();
    pollRef.current = setInterval(fetchJob, 1500);
    return () => {
      mounted = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id]);

  return { job, loading, error, videoUrl };
}
