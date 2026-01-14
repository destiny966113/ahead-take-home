import { useEffect, useState } from "react";
import { listJobs } from "@/lib/api";
import { Progress } from "@/components/ui/progress";

export default function JobList(){
  const [data, setData] = useState<any>({ queued: [], started: [], finished: [], failed: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() =>{
    let mounted = true;
    async function tick(){
      try{
        const res = await listJobs();
        if (mounted){
          setData(res);
          setError("");
          setLoading(false);
        }
      }catch(e: any){
        setError(e?.message || "載入失敗");
        setLoading(false);
      }
    }
    tick();
    const t = setInterval(tick, 2000);
    return () => { mounted = false; clearInterval(t); }
  }, []);

  const renderList = (label: string, jobs: any[]) => (
    <div>
      <h3 className="text-sm font-medium mb-2">{label}</h3>
      <div className="space-y-2">
        {jobs.length === 0 && <div className="text-sm text-muted-foreground">無</div>}
        {jobs.map((j) => (
          <div key={j.id} className="border rounded-md p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm">{j.id}</div>
              <div className="text-xs text-muted-foreground">{j.meta?.phase || j.status}</div>
            </div>
            <Progress value={j.meta?.progress || (j.status === 'finished' ? 100 : 0)} className="h-2"/>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">任務清單</h1>
          <div className="flex items-center gap-4">
            <a href="/" className="text-primary">首頁</a>
            <a href="/ai-video" className="text-primary">AI 後製</a>
          </div>
        </header>
        {loading ? (
          <div className="text-muted-foreground">載入中…</div>
        ) : error ? (
          <div className="text-destructive">{error}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderList('排隊中', data.queued)}
            {renderList('處理中', data.started)}
            {renderList('完成', data.finished)}
            {renderList('失敗', data.failed)}
          </div>
        )}
      </div>
    </div>
  )
}
