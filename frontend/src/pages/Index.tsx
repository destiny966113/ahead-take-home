import React, { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { RecordingsTable } from "@/components/recordings/RecordingsTable";
import { ProcessingJobsTable, ProcessingJob } from "@/components/recordings/ProcessingJobsTable";
import { GlossarySection } from "@/components/glossary/GlossarySection";
import { useApiRecordings } from "@/hooks/useApiRecordings";
import { useApiJobs } from "@/hooks/useApiJobs";
import { startJobs } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

const mapQueueToProcessing = (jobs: any[]): ProcessingJob[] => {
  return jobs.slice(0, 10).map((j: any) => ({
    id: j.id,
    recordingName: j.recordingName || j.meta?.filename || '未命名錄影',
    jobId: j.id,
    remainingTime: (j.createdAt ? new Date(j.createdAt).toLocaleString('zh-TW', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' }) : ''),
    progress: j.progress ?? 0,
    status: j.status,
  }))
}

const Index: React.FC = () => {
  const { recordings, loading, refetch } = useApiRecordings();
  const { jobs: queueJobs, refresh: refreshJobs } = useApiJobs();
  const jobs: ProcessingJob[] = mapQueueToProcessing(queueJobs as any);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterValue, setFilterValue] = useState<string>("");
  const [glossary, setGlossary] = useState({
    title: "Mathematical thinking",
    date: "Dec 16, 2025",
    entryCount: 3235,
  });

  const jobsPerPage = 10;
  const totalPages = Math.ceil(jobs.length / jobsPerPage);
  const paginatedJobs = jobs.slice(
    (currentPage - 1) * jobsPerPage,
    currentPage * jobsPerPage
  );

  const handleProcess = async (selectedIds: string[], asrStreaming?: boolean, glossaryLang: 'zh' | 'ja' = 'zh') => {
    if (!selectedIds.length) {
      toast({ title: "請選擇錄影檔", description: "請至少選擇一個錄影檔", variant: "destructive" });
      return;
    }
    try{
      const res = await startJobs(selectedIds, true, asrStreaming, glossaryLang);
      console.info(`[api] startJobs (home): ${res.jobs.join(',')} (streaming: ${asrStreaming}) (glossary: ${glossaryLang})`);
      toast({ title: "已建立處理任務", description: `共 ${res.jobs.length} 件` });
      refreshJobs();
    }catch(e:any){
      toast({ title: "建立任務失敗", description: e?.message || '請稍後再試', variant: 'destructive' });
    }
  };

  const handleGlossaryUpload = async (file: File) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    setGlossary({
      title: file.name.replace(".csv", ""),
      date: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      entryCount: Math.floor(Math.random() * 5000) + 1000,
    });
    toast({
      title: "Glossary updated",
      description: "Your glossary has been successfully uploaded.",
    });
  };

  const handlePreviewGlossary = () => {
    toast({
      title: "Preview glossary",
      description: `Viewing: ${glossary.title}`,
    });
  };

  return (
    <DashboardLayout title="Play">
      <div className="space-y-6">
        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recordings Table */}
          <RecordingsTable 
            recordings={recordings} 
            loading={loading}
            onProcess={handleProcess} 
            onRefresh={refetch}
          />

          {/* Processing Jobs Table */}
          <ProcessingJobsTable
            jobs={paginatedJobs}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            filterValue={filterValue}
            onFilterChange={setFilterValue}
          />
        </div>

        {/* Glossary Section */}
        <GlossarySection
          glossary={glossary}
          onPreview={handlePreviewGlossary}
          onUpload={handleGlossaryUpload}
        />
      </div>
    </DashboardLayout>
  );
};

export default Index;
