import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { deleteJob } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export interface ProcessingJob {
  id: string;
  recordingName: string;
  jobId: string;
  remainingTime: string;
  isUrgent?: boolean;
  progress?: number;
  status?: string;
}

interface ProcessingJobsTableProps {
  jobs: ProcessingJob[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
}

export const ProcessingJobsTable = React.forwardRef<HTMLDivElement, ProcessingJobsTableProps>(
  ({ jobs, currentPage, totalPages, onPageChange, filterValue, onFilterChange }, ref) => {
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  const handleSelectAll = (checked: boolean) => {
    const c = !!checked;
    setSelectAll(c);
    if (c) setSelectedIds(new Set(jobs.map(j => j.id)));
    else setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`確定刪除 ${selectedIds.size} 個任務嗎？`)) return;
    try {
      await Promise.all(Array.from(selectedIds).map(id => deleteJob(id, true)));
      toast({ title: '已刪除所選任務', description: `${selectedIds.size} 筆` });
      setSelectedIds(new Set());
      setSelectAll(false);
    } catch (e:any) {
      toast({ title: '刪除失敗', description: e?.message || '請稍後再試', variant: 'destructive' });
    }
  };
  return (
    <div ref={ref} className="card-elevated h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Processing jobs</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleBulkDelete} disabled={selectedIds.size === 0}>
            <Trash2 className="w-4 h-4 mr-2" /> 刪除選取
          </Button>
          <span className="text-sm text-muted-foreground">Filter by</span>
          <Select value={filterValue} onValueChange={onFilterChange}>
            <SelectTrigger className="w-32 h-8 text-sm">
              <SelectValue placeholder="Please select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="w-12 px-6 py-3 text-left">
                <Checkbox checked={selectAll} onCheckedChange={handleSelectAll} />
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                Recording name
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Job ID
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Progress
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-muted-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <p className="text-muted-foreground font-medium">
                      No processing jobs yet.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Select recordings to begin processing.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              jobs.map((job, index) => (
                <tr
                  key={job.id}
                  className={cn(
                    "table-row-hover border-b border-border last:border-b-0",
                    index % 2 === 0 ? "bg-card" : "bg-muted/30"
                  )}
                >
                  <td className="px-6 py-3">
                    <Checkbox checked={selectedIds.has(job.id)} onCheckedChange={(ck)=>{
                      const checked = ck as boolean; const s=new Set(selectedIds); if(checked) s.add(job.id); else s.delete(job.id); setSelectedIds(s); setSelectAll(s.size===jobs.length);
                    }} />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-foreground">
                    {job.recordingName}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                    {job.jobId}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Progress value={job.progress ?? 0} className="w-16 h-2" />
                      <span className="text-xs text-muted-foreground">{job.progress ?? 0}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        className="text-link text-sm"
                        onClick={() => navigate(`/ai-video/result/${job.jobId}`)}
                      >
                        Open
                      </button>
                      <button
                        className="p-1.5 hover:bg-destructive/10 rounded-md transition-colors"
                        title="刪除任務"
                        onClick={async () => {
                          if (!confirm(`確定刪除任務 ${job.jobId} 嗎？`)) return;
                          try {
                            await deleteJob(job.jobId, true);
                            toast({ title: '已刪除任務', description: job.recordingName });
                            onPageChange(currentPage); // 觸發重繪
                          } catch (e:any) {
                            toast({ title: '刪除失敗', description: e?.message || '請稍後再試', variant: 'destructive' });
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 px-6 py-4 border-t border-border">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-1.5 hover:bg-muted rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={cn(
                "w-8 h-8 text-sm font-medium rounded-md transition-colors",
                page === currentPage
                  ? "border border-border bg-card text-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-1.5 hover:bg-muted rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
});

ProcessingJobsTable.displayName = "ProcessingJobsTable";
