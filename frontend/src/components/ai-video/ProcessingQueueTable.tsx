import React, { useState } from "react";
import { Eye, ChevronDown, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { deleteJob } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

export interface ProcessingQueueJob {
  id: string;
  taskId: string;
  recordingName?: string;
  status: string;
  progress: number;
  canView: boolean;
}

interface ProcessingQueueTableProps {
  jobs: ProcessingQueueJob[];
  loading?: boolean;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case '已完成':
      return 'text-green-500';
    case '處理中':
    case '轉錄中':
    case '分類中':
      return 'text-blue-500';
    case '排隊中':
      return 'text-yellow-500';
    case '失敗':
      return 'text-red-500';
    default:
      return 'text-muted-foreground';
  }
};

const isProcessing = (status: string) => {
  return ['處理中', '轉錄中', '分類中'].includes(status);
};

export const ProcessingQueueTable = React.forwardRef<HTMLDivElement, ProcessingQueueTableProps>(
  ({ jobs, loading }, ref) => {
    const navigate = useNavigate();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [selectAll, setSelectAll] = useState(false);

    const handleView = (job: ProcessingQueueJob) => {
      if (job.canView) {
        navigate(`/ai-video/result/${job.id}`);
      }
    };

    const handleSelectAll = (checked: boolean) => {
      setSelectAll(!!checked);
      if (checked) {
        setSelectedIds(new Set(jobs.map(j => j.id)));
      } else {
        setSelectedIds(new Set());
      }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
      const s = new Set(selectedIds);
      if (checked) s.add(id); else s.delete(id);
      setSelectedIds(s);
      setSelectAll(s.size === jobs.length);
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
      <div ref={ref} className="card-elevated flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">處理佇列</h2>
          <Button variant="outline" size="sm" onClick={handleBulkDelete} disabled={selectedIds.size === 0}>
            <Trash2 className="w-4 h-4 mr-2" />
            刪除選取
          </Button>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-border">
          <span className="text-sm text-muted-foreground">篩選：會議日期</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              尚無處理任務
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="w-12 px-6 py-3 text-left">
                    <Checkbox checked={selectAll} onCheckedChange={handleSelectAll} />
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                    錄影檔名稱
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    狀態
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    進度
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">
                    檢視
                  </th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    className={cn(
                      "border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors"
                    )}
                  >
                    <td className="px-6 py-3">
                      <Checkbox checked={selectedIds.has(job.id)} onCheckedChange={(ck)=>handleSelectOne(job.id, ck as boolean)} />
                    </td>
                    <td className="px-6 py-3 text-sm text-foreground max-w-[200px] truncate">
                      {job.recordingName || job.taskId.substring(0, 12)}
                    </td>
                    <td className={cn("px-4 py-3 text-sm", getStatusColor(job.status))}>
                      <div className="flex items-center gap-2">
                        {isProcessing(job.status) && (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        )}
                        {job.status}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Progress value={job.progress} className="w-16 h-2" />
                        <span className="text-xs text-muted-foreground">
                          {job.progress}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleView(job)}
                        className={cn(
                          "p-1.5 rounded-md transition-colors hover:bg-muted text-foreground cursor-pointer"
                        )}
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }
);

ProcessingQueueTable.displayName = "ProcessingQueueTable";
