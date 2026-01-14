import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { VideoPlayer } from "@/components/ai-video/VideoPlayer";
import { SyncedClipsSubtitles, VideoClip, SubtitleSegment } from "@/components/ai-video/SyncedClipsSubtitles";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useApiJobDetail } from "@/hooks/useApiJobDetail";
import { API_BASE, mergeCourse, startJobs, getGlossaryInfo } from "@/lib/api";
import { format } from "date-fns";
import { ArrowLeft, Download, AlertCircle, Loader2, PlayCircle, RefreshCcw, Info } from "lucide-react";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const AIVideoResult = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { job, loading, error, videoUrl } = useApiJobDetail(id);
  
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedClipId, setSelectedClipId] = useState<string | undefined>();
  const [currentSubtitle, setCurrentSubtitle] = useState<string>("");
  const [currentSubtitleHtml, setCurrentSubtitleHtml] = useState<string>("");
  const [glossaryNewerThanJob, setGlossaryNewerThanJob] = useState(false);

  // Convert processing result segments to video clips
  const videoClips: VideoClip[] = job?.result?.segments?.map((segment, index) => ({
    id: segment.segment_id.toString(),
    clipNumber: segment.segment_id,
    startTime: formatTime(segment.start_time),
    endTime: formatTime(segment.end_time),
    startSec: segment.start_time,
    endSec: segment.end_time,
    duration: segment.duration || (segment.end_time - segment.start_time),
    transcript: segment.transcript,
    transcriptHtml: segment.transcript_marked,
    classification: segment.classification,
  })) || [];

  // Convert segments to subtitle format
  const baseSubtitleSegments: SubtitleSegment[] = job?.result?.segments?.map((segment) => ({
    id: segment.segment_id.toString(),
    startTime: segment.start_time,
    endTime: segment.end_time,
    text: segment.transcript,
    classification: segment.classification,
  })) || [];

  // Edited subtitle state (persist user edits)
  const [editedSegments, setEditedSegments] = useState<SubtitleSegment[]>(baseSubtitleSegments);
  useEffect(() => {
    setEditedSegments(baseSubtitleSegments);
  }, [job?.result?.segments]);

  // Smart play removed

  // Update current subtitle based on video time
  useEffect(() => {
    if (editedSegments?.length) {
      const currentSegment = editedSegments.find(
        s => s.startTime !== undefined && s.endTime !== undefined && currentTime >= (s.startTime as number) && currentTime <= (s.endTime as number)
      );
      setCurrentSubtitle(currentSegment?.text || "");
      setCurrentSubtitleHtml("");
    }
  }, [currentTime, editedSegments]);

  // Check if glossary was updated after this job created to suggest reprocessing
  useEffect(() => {
    (async () => {
      try {
        if (!job?.created_at) return;
        const res = await getGlossaryInfo();
        const up = res?.glossary?.upload_time ? new Date(res.glossary.upload_time) : null;
        const jc = new Date(job.created_at);
        if (up && up.getTime() > jc.getTime()) {
          setGlossaryNewerThanJob(true);
        } else {
          setGlossaryNewerThanJob(false);
        }
      } catch {}
    })();
  }, [job?.created_at]);

  const handleBackToList = () => {
    navigate("/ai-video");
  };

  const handleClipSelect = (clip: VideoClip) => {
    setSelectedClipId(clip.id);
  };

  const handleClipPlay = (clip: VideoClip) => {
    // Seek to the start time of the chosen segment; playback will auto-start in player
    const segment = job?.result?.segments?.find(s => s.segment_id.toString() === clip.id);
    if (segment) setCurrentTime(segment.start_time);
  };

  const handleSubtitleSegmentClick = (segment: SubtitleSegment) => {
    if (segment.startTime !== undefined) {
      setCurrentTime(segment.startTime);
    }
  };

  const handleSaveSubtitles = (updatedSegments: SubtitleSegment[]) => {
    setEditedSegments(updatedSegments);
    toast({
      title: "字幕已儲存",
      description: "您編輯的字幕已成功儲存。",
    });
  };

  // Direct download helpers
  function sanitizeBaseName(name?: string, fallback = 'download') {
    if (!name) return fallback;
    const base = name.replace(/\s+/g, '_').replace(/[\\/]+/g, '-');
    return base.replace(/\.[A-Za-z0-9]{1,5}$/,'');
  }
  function triggerDownload(url: string, filename: string) {
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', filename);
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try { document.body.removeChild(a); } catch {} }, 0);
  }

  // No local "全部字幕"下載；改為後端正課字幕

  if (loading) {
    return (
      <DashboardLayout title="AI 視訊後製">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5">
              <Skeleton className="aspect-video w-full" />
            </div>
            <div className="lg:col-span-7">
              <Skeleton className="h-[500px] w-full" />
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !job) {
    return (
      <DashboardLayout title="AI 視訊後製">
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <h2 className="text-xl font-semibold text-foreground">載入失敗</h2>
          <p className="text-muted-foreground">{error || "找不到此處理任務"}</p>
          <Button onClick={handleBackToList}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回任務列表
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const statistics = job.result?.statistics;

  return (
    <DashboardLayout title="AI 視訊後製">
      <div className="space-y-6">
        {/* Back button and title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-foreground">AI 後製成果</h1>
            <Badge 
              variant={job.status === '已完成' ? 'default' : job.status === '失敗' ? 'destructive' : 'secondary'}
            >
              {job.status}
            </Badge>
          </div>
          <Button variant="outline" size="sm" onClick={handleBackToList}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回影片任務選擇頁
          </Button>
        </div>

        {/* Job Info */}
        <div className="card-elevated">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 px-6 py-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">錄影名稱</p>
              <p className="text-sm font-medium text-foreground truncate" title={job.recording?.name}>
                {job.recording?.name || '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">處理日期</p>
              <p className="text-sm font-medium text-foreground">
                {format(new Date(job.created_at), 'yyyy/MM/dd HH:mm')}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">錄影時長</p>
              <p className="text-sm font-medium text-foreground">
                {job.recording?.duration || '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">任務 ID</p>
              <p className="text-sm font-medium text-foreground font-mono">
                {job.task_id}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">處理進度</p>
              <p className="text-sm font-medium text-foreground">
                {job.progress}%
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">片段統計</p>
              <p className="text-sm font-medium text-foreground">
                {statistics ? (
                  <>
                    正課: {statistics.正課內容} / 雜談: {statistics.笑話雜談}
                  </>
                ) : '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Error message if failed */}
        {job.status === '失敗' && job.error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">處理失敗</p>
                <p className="text-sm text-destructive/80 mt-1">{job.error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Processing indicator */}
        {job.status !== '已完成' && job.status !== '失敗' && (
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
              <div>
                <p className="text-sm font-medium text-primary">處理中</p>
                <p className="text-sm text-primary/80 mt-1">
                  目前狀態: {job.status} ({job.progress}%)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Video Player - 5 columns */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <PlayCircle className="w-5 h-5 text-primary" />
                影片播放
              </h3>
            </div>
            <VideoPlayer
              videoUrl={videoUrl}
              subtitleText={currentSubtitle}
              subtitleHtml={currentSubtitleHtml}
              currentTime={currentTime}
              onTimeUpdate={setCurrentTime}
              autoPlayOnExternalSeek={true}
            />
          </div>

          {/* Synced Clips & Subtitles - 7 columns */}
          <div className="lg:col-span-7">
            <SyncedClipsSubtitles
              clips={videoClips}
              segments={editedSegments}
              currentTime={currentTime}
              selectedClipId={selectedClipId}
              onClipSelect={handleClipSelect}
              onClipPlay={handleClipPlay}
              onSegmentClick={handleSubtitleSegmentClick}
              onSaveSubtitles={handleSaveSubtitles}
            />
          </div>
        </div>

        {/* Glossary updated notice */}
        {glossaryNewerThanJob && (
          <div className="flex items-start gap-3 p-3 rounded-md border border-primary/30 bg-primary/10">
            <Info className="w-4 h-4 text-primary mt-0.5" />
            <div className="flex-1 text-sm">
              偵測到詞彙表在此任務之後有更新。若需套用最新詞彙表，請重新後製。
            </div>
            <Button size="sm" onClick={async ()=>{
              try{
                if (!job?.recordingId) return;
                const resp = await startJobs([job.recordingId], true);
                if (resp.jobs?.length){
                  toast({ title: "已建立重新後製任務", description: "將導向新任務頁面" });
                  navigate(`/ai-video/result/${resp.jobs[0]}`);
                }
              }catch(e:any){
                toast({ title: "重新後製失敗", description: e?.message || '請稍後再試', variant: 'destructive' });
              }
            }}>
              <RefreshCcw className="w-4 h-4 mr-1" /> 重新後製
            </Button>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-4">
          <Button variant="secondary" onClick={async () => {
            // Call backend to merge course-only video+subtitle, but only use subtitle for download
            if (!id) return;
            try {
              const updates = editedSegments.map(s => ({ segment_id: parseInt(s.id, 10), transcript: s.text }));
              const resp = await mergeCourse(id, updates, false, true);
              if (resp.subtitle_url || resp.subtitle_urls?.srt) {
                const base = sanitizeBaseName(job?.recording?.name, 'subtitles');
                const filename = `${base}_course.srt`;
                const url = `${API_BASE}${(resp.subtitle_urls?.srt || resp.subtitle_url)}`;
                triggerDownload(url, filename);
                toast({ title: "已開始下載", description: "正課字幕 (SRT) 已下載" });
              } else {
                toast({ title: "沒有可下載的字幕", variant: 'destructive' });
              }
            } catch (e: any) {
              toast({ title: "下載失敗", description: e?.message || '請稍後再試', variant: 'destructive' });
            }
          }} disabled={!editedSegments.length}>
            <Download className="w-4 h-4 mr-2" />
            下載正課字幕 (SRT)
          </Button>
          <Button variant="outline" onClick={async () => {
            if (!id) return;
            try {
              const updates = editedSegments.map(s => ({ segment_id: parseInt(s.id, 10), transcript: s.text }));
              const resp = await mergeCourse(id, updates, false, true);
              if (resp.subtitle_urls?.vtt) {
                const base = sanitizeBaseName(job?.recording?.name, 'subtitles');
                const filename = `${base}_course.vtt`;
                triggerDownload(`${API_BASE}${resp.subtitle_urls.vtt}`, filename);
                toast({ title: "已開始下載", description: "正課字幕 (VTT) 已下載" });
              } else {
                toast({ title: "沒有可下載的 VTT 字幕", variant: 'destructive' });
              }
            } catch (e: any) {
              toast({ title: "下載失敗", description: e?.message || '請稍後再試', variant: 'destructive' });
            }
          }} disabled={!editedSegments.length}>
            <Download className="w-4 h-4 mr-2" />
            下載正課字幕 (VTT)
          </Button>
          <Button variant="outline" onClick={async () => {
            if (!id) return;
            try {
              const updates = editedSegments.map(s => ({ segment_id: parseInt(s.id, 10), transcript: s.text }));
              const resp = await mergeCourse(id, updates, false, true);
              if (resp.subtitle_urls?.json) {
                const base = sanitizeBaseName(job?.recording?.name, 'subtitles');
                const filename = `${base}_course.json`;
                triggerDownload(`${API_BASE}${resp.subtitle_urls.json}`, filename);
                toast({ title: "已開始下載", description: "正課字幕 (JSON) 已下載" });
              } else {
                toast({ title: "沒有可下載的 JSON 字幕", variant: 'destructive' });
              }
            } catch (e: any) {
              toast({ title: "下載失敗", description: e?.message || '請稍後再試', variant: 'destructive' });
            }
          }} disabled={!editedSegments.length}>
            <Download className="w-4 h-4 mr-2" />
            下載正課字幕 (JSON)
          </Button>
          <Button variant="default" onClick={async () => {
            if (!id) return;
            try {
              const updates = editedSegments.map(s => ({ segment_id: parseInt(s.id, 10), transcript: s.text }));
              const resp = await mergeCourse(id, updates, true, false);
              if (resp.video_url) {
                const base = sanitizeBaseName(job?.recording?.name, 'video');
                const filename = `${base}_course.mp4`;
                triggerDownload(`${API_BASE}${resp.video_url}`, filename);
                toast({ title: "已開始下載", description: "正課合併影片 已下載" });
              } else {
                toast({ title: "沒有可下載的正課影片", variant: 'destructive' });
              }
            } catch (e: any) {
              toast({ title: "下載失敗", description: e?.message || '請稍後再試', variant: 'destructive' });
            }
          }} disabled={!editedSegments.length}>
            <Download className="w-4 h-4 mr-2" />
            下載正課影片
          </Button>
          {/* Explicit reprocess button even if glossary not newer */}
          <Button variant="outline" onClick={async ()=>{
            try{
              if (!job?.recordingId) return;
              const resp = await startJobs([job.recordingId], true);
              if (resp.jobs?.length){
                toast({ title: "已建立重新後製任務", description: "將導向新任務頁面" });
                navigate(`/ai-video/result/${resp.jobs[0]}`);
              }
            }catch(e:any){
              toast({ title: "重新後製失敗", description: e?.message || '請稍後再試', variant: 'destructive' });
            }
          }}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            以最新詞彙表重新後製
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

// (no local SRT generator; using backend merged SRT)

export default AIVideoResult;
