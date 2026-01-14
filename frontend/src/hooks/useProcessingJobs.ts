import { useState, useEffect } from "react";
// Supabase removed: use backend API endpoints only
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export interface ProcessingJob {
  id: string;
  taskId: string;
  recordingId: string;
  recordingName?: string;
  status: string;
  progress: number;
  totalSegments: number;
  processedSegments: number;
  result: any;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  canView: boolean;
}

export function useProcessingJobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/jobs`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const combine = [
        ...(data.queued || []),
        ...(data.started || []),
        ...(data.finished || []),
        ...(data.failed || []),
      ];
      const formatted: ProcessingJob[] = combine.map((j: any) => ({
        id: j.id,
        taskId: j.id,
        recordingId: j.meta?.recording_id || '',
        recordingName: j.meta?.filename || '未知錄影檔',
        status: j.status,
        progress: j.meta?.progress ?? (j.status === 'finished' ? 100 : 0),
        totalSegments: 0,
        processedSegments: 0,
        result: j.result || null,
        error: j.error || null,
        createdAt: j.enqueued_at,
        updatedAt: j.ended_at || j.started_at || j.enqueued_at,
        canView: j.status === 'finished',
      }));
      setJobs(formatted);
    } catch (error) {
      console.error('Error fetching processing jobs:', error);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  // Polling updates via backend API
  useEffect(() => {
    fetchJobs();
    const t = setInterval(fetchJobs, 1500);
    return () => clearInterval(t);
  }, []);

  const startProcessing = async (recordingIds: string[]) => {
    try {
      const res = await fetch(`/api/jobs/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recording_ids: recordingIds, cut_clips: true })
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: '處理任務已建立', description: '後端已啟動處理流程' });
      await fetchJobs();
      return true;
    } catch (error) {
      console.error('Error starting processing:', error);
      toast({ title: '錯誤', description: error instanceof Error ? error.message : '無法啟動處理任務', variant: 'destructive' });
      return false;
    }
  };

  return {
    jobs,
    loading,
    refetch: fetchJobs,
    startProcessing,
  };
}
