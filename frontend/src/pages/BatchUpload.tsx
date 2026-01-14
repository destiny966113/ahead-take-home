import { useEffect, useMemo, useState } from "react";
import { uploadBatch, getJob } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, Loader2, CheckCircle, AlertCircle, List } from "lucide-react";

interface TrackedJob {
  id: string;
  status: string;
  progress?: number;
  phase?: string;
  error?: string;
}

export default function BatchUpload(){
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [jobs, setJobs] = useState<TrackedJob[]>([]);
  const [error, setError] = useState<string>("");

  function onFilesSelect(e: React.ChangeEvent<HTMLInputElement>){
    const list = e.target.files ? Array.from(e.target.files) : [];
    setFiles(list);
  }

  async function onSubmit(){
    if (!files.length) return;
    setSubmitting(true);
    setError("");
    try{
      const res = await uploadBatch(files, true);
      const js = res.jobs.map((id) => ({ id, status: "queued" } as TrackedJob));
      setJobs((prev) => [...js, ...prev]);
      // Persist job ids to localStorage for tracking
      const prevIds = JSON.parse(localStorage.getItem("jobIds") || "[]");
      localStorage.setItem("jobIds", JSON.stringify([...res.jobs, ...prevIds]));
    }catch(e: any){
      setError(e?.message || "上傳失敗");
    }finally{
      setSubmitting(false);
    }
  }

  // Poll status for tracked jobs
  useEffect(() =>{
    const ids = JSON.parse(localStorage.getItem("jobIds") || "[]") as string[];
    if (ids.length){
      setJobs((prev) => {
        // ensure tracked
        const mapped: Record<string, TrackedJob> = {};
        for(const j of prev) mapped[j.id] = j;
        for(const id of ids) mapped[id] = mapped[id] || { id, status: "queued" };
        return Object.values(mapped);
      })
    }
  }, []);

  useEffect(() =>{
    if (!jobs.length) return;
    const t = setInterval(() =>{
      const snapshot = [...jobs];
      Promise.all(snapshot.map(async (j) => {
        try {
          const data = await getJob(j.id);
          if (data.status !== j.status) {
            console.info(`[jobs] ${j.id} status: ${j.status} -> ${data.status} (phase=${data.meta?.phase}, progress=${data.meta?.progress})`);
          }
          return {
            id: j.id,
            status: data.status,
            progress: data.meta?.progress,
            phase: data.meta?.phase,
            error: data.error,
          } as TrackedJob;
        } catch {
          return j;
        }
      })).then((updated) => setJobs(updated));
    }, 1500);
    return () => clearInterval(t);
  }, [jobs]);

  useEffect(() => {
    // UI toasts when a job finishes or fails
    const finished = jobs.filter(j => j.status === 'finished');
    const failed = jobs.filter(j => j.status === 'failed');
    if (finished.length) {
      console.info(`[jobs] finished: ${finished.map(j => j.id).join(',')}`);
    }
    if (failed.length) {
      console.warn(`[jobs] failed: ${failed.map(j => j.id).join(',')}`);
    }
  }, [jobs]);

  const running = useMemo(() => jobs.filter(j => j.status !== 'finished' && j.status !== 'failed'), [jobs]);
  const finished = useMemo(() => jobs.filter(j => j.status === 'finished'), [jobs]);
  const failed = useMemo(() => jobs.filter(j => j.status === 'failed'), [jobs]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">批次影片上傳</h1>
          <a href="/jobs" className="text-primary inline-flex items-center gap-1">
            <List className="w-4 h-4"/> 查看任務
          </a>
        </header>

        <div className="border border-border rounded-lg p-6 bg-card">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <input type="file" multiple accept=".mp4,.mpeg,.mpg,.mov,.avi,.webm,.mkv,.wav,.mp3,.m4a,.flac" onChange={onFilesSelect} className="hidden" id="fileInput"/>
              <label htmlFor="fileInput" className="block border-2 border-dashed rounded-lg p-8 text-center cursor-pointer upload-dropzone">
                <Upload className="w-8 h-8 text-primary mx-auto mb-2"/>
                <div className="font-medium">拖放或點擊選擇檔案</div>
                <div className="text-sm text-muted-foreground mt-1">支援影片與音訊，多選批次上傳</div>
              </label>
              {files.length > 0 && (
                <div className="mt-4 text-sm text-muted-foreground">已選擇 {files.length} 個檔案</div>
              )}
            </div>
            <div className="w-40 flex-shrink-0 flex flex-col gap-2">
              <Button onClick={onSubmit} disabled={submitting || files.length === 0}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : null}
                開始上傳
              </Button>
              {error && (
                <div className="text-destructive text-sm inline-flex items-center gap-1"><AlertCircle className="w-4 h-4"/> {error}</div>
              )}
            </div>
          </div>
        </div>

        {jobs.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">處理狀態</h2>
            {jobs.map(j => (
              <div key={j.id} className="border rounded-lg p-4 bg-secondary">
                <div className="flex items-center justify-between">
                  <div className="text-sm">任務 {j.id.substring(0, 8)}…</div>
                  <div className="text-sm text-muted-foreground">{j.phase || j.status}</div>
                </div>
                <div className="mt-2">
                  <Progress value={j.progress || (j.status === 'finished' ? 100 : 0)} className="h-2"/>
                </div>
                {j.status === 'finished' && (
                  <div className="mt-2 text-green-600 dark:text-green-400 inline-flex items-center gap-1 text-sm"><CheckCircle className="w-4 h-4"/> 完成</div>
                )}
                {j.status === 'failed' && (
                  <div className="mt-2 text-destructive text-sm inline-flex items-center gap-1"><AlertCircle className="w-4 h-4"/> 失敗</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
