import { useEffect, useState } from "react";
import { listJobs, getJob } from "@/lib/api";

export interface ApiQueueJob {
  id: string;
  taskId: string;
  recordingName?: string;
  status: string; // zh label
  progress: number;
  canView: boolean;
  createdAt?: string;
}

function mapStatus(s: string) {
  switch (s) {
    case "queued":
      return "排隊中";
    case "started":
      return "處理中";
    case "finished":
      return "已完成";
    case "failed":
      return "失敗";
    default:
      return s;
  }
}

export function useApiJobs() {
  const [jobs, setJobs] = useState<ApiQueueJob[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const data = await listJobs();
      const combine = [...(data.queued || []), ...(data.started || []), ...(data.finished || []), ...(data.failed || [])];
      const mapped: ApiQueueJob[] = combine.map((j: any) => ({
        id: j.id,
        taskId: j.id,
        recordingName: j.meta?.filename || undefined,
        status: mapStatus(j.status),
        progress: j.meta?.progress ?? (j.status === 'finished' ? 100 : 0),
        canView: true,
        createdAt: j.enqueued_at || j.started_at || j.ended_at,
      }));
      console.info(`[api] jobs summary: queued=${(data.queued||[]).length} started=${(data.started||[]).length} finished=${(data.finished||[]).length} failed=${(data.failed||[]).length}`)
      setJobs(mapped);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    refresh(true);
    const t = setInterval(() => refresh(false), 1500);
    return () => clearInterval(t);
  }, []);

  return { jobs, loading, refresh };
}
