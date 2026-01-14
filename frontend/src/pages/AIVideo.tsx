import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { RecordingListTable } from "@/components/ai-video/RecordingListTable";
import { ProcessingQueueTable, ProcessingQueueJob } from "@/components/ai-video/ProcessingQueueTable";
import { GlossaryManagement } from "@/components/ai-video/GlossaryManagement";
import { toast } from "@/hooks/use-toast";
import { useApiRecordings } from "@/hooks/useApiRecordings";
import { useApiJobs } from "@/hooks/useApiJobs";
import { uploadBatch, startJobs, uploadGlossary, getGlossaryInfo } from "@/lib/api";
import { Loader2 } from "lucide-react";

const AIVideo: React.FC = () => {
  const { recordings, loading: recordingsLoading } = useApiRecordings();
  const { jobs, loading: jobsLoading, refresh } = useApiJobs();
  const [glossary, setGlossary] = useState({
    fileName: "",
    uploadTime: "",
    entryCount: 0,
  });

  // Load glossary info on mount
  useEffect(() => {
    const loadGlossaryInfo = async () => {
      try {
        const res = await getGlossaryInfo();
        if (res.success && res.glossary.filename) {
          setGlossary({
            fileName: res.glossary.filename.replace(/\.(csv|xlsx|xls|txt)$/i, ""),
            uploadTime: res.glossary.upload_time
              ? new Date(res.glossary.upload_time).toLocaleString("zh-TW")
              : "",
            entryCount: res.glossary.entry_count,
          });
        }
      } catch (err) {
        console.error("Failed to load glossary info:", err);
      }
    };
    loadGlossaryInfo();
  }, []);

  // Transform recordings to the format expected by RecordingListTable
  const formattedRecordings = recordings.map((rec) => ({
    id: rec.id,
    name: rec.name,
    date: rec.date,
    duration: rec.length || "--:--:--",
    previewUrl: rec.previewUrl,
  }));

  // Transform jobs to the format expected by ProcessingQueueTable
  const formattedJobs: ProcessingQueueJob[] = jobs.map((job) => ({
    id: job.id,
    taskId: job.taskId,
    recordingName: job.recordingName,
    status: job.status,
    progress: job.progress,
    canView: job.canView,
  }));

  const handleProcess = async (selectedIds: string[]) => {
    if (!selectedIds.length) {
      toast({ title: "請選擇錄影檔", description: "請至少選擇一個錄影檔進行處理", variant: "destructive" });
      return;
    }
    try{
      const res = await startJobs(selectedIds, true);
      console.info(`[api] startJobs: ${res.jobs.join(',')}`);
      toast({ title: "已建立處理任務", description: `共 ${res.jobs.length} 件` });
      refresh();
    }catch(e:any){
      toast({ title: "建立任務失敗", description: e?.message || '請稍後再試', variant: 'destructive' });
    }
  };

  const handleGlossaryUpload = async (file: File) => {
    try {
      const res = await uploadGlossary(file);
      if (res.success && res.stats) {
        setGlossary({
          fileName: res.stats.filename?.replace(/\.(csv|xlsx|xls|txt)$/i, "") || "",
          uploadTime: res.stats.upload_time
            ? new Date(res.stats.upload_time).toLocaleString("zh-TW")
            : "",
          entryCount: res.stats.entry_count,
        });
        toast({
          title: "詞彙表已更新",
          description: `已成功上傳 ${res.stats.entry_count} 個詞條`,
        });
      }
    } catch (err: any) {
      toast({
        title: "上傳失敗",
        description: err?.message || "請稍後重試",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout title="AI 視訊後製">
      <div className="space-y-6">
        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Recording List - 3 columns */}
          <div className="lg:col-span-3">
            {recordingsLoading ? (
              <div className="card-elevated flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : (
              <RecordingListTable recordings={formattedRecordings} onProcess={handleProcess} />
            )}
          </div>

          {/* Right side panels - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Processing Queue */}
            <ProcessingQueueTable jobs={formattedJobs} loading={jobsLoading} />

            {/* Glossary Management */}
            <GlossaryManagement
              glossary={glossary}
              onUpload={handleGlossaryUpload}
            />
            {/* Upload area */}
            <div className="card-elevated p-4">
              <h3 className="text-base font-semibold text-foreground mb-2">批次上傳影片/音訊</h3>
              <input
                id="upload-files"
                type="file"
                className="hidden"
                multiple
                accept=".mp4,.mpeg,.mpg,.mov,.avi,.webm,.mkv,.wav,.mp3,.m4a,.flac"
                onChange={async (e) => {
                  const files = e.target.files ? Array.from(e.target.files) : [];
                  if (!files.length) return;
                  try {
                    const res = await uploadBatch(files, true);
                    toast({ title: "已建立處理任務", description: `共 ${res.jobs.length} 件` });
                    refresh();
                  } catch (err: any) {
                    toast({ title: "上傳失敗", description: err?.message || "請稍後重試", variant: "destructive" });
                  } finally {
                    if (e.target) e.target.value = "";
                  }
                }}
              />
              <label htmlFor="upload-files" className="inline-flex items-center gap-2 text-primary cursor-pointer underline">
                選擇檔案進行上傳
              </label>
              <p className="text-xs text-muted-foreground mt-1">支援多檔選擇，將自動排入佇列並於下方顯示進度</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AIVideo;
