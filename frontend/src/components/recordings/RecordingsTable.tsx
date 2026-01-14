import React, { useState } from "react";
import { Eye, Loader2, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { VideoUpload } from "./VideoUpload";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteRecording } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

export interface Recording {
  id: string;
  name: string;
  date: string;
  length: string;
  status: string;
  previewUrl?: string;
}

interface RecordingsTableProps {
  recordings: Recording[];
  loading?: boolean;
  onProcess?: (selectedIds: string[], asrStreaming?: boolean, glossaryLang?: 'zh' | 'ja') => void;
  onRefresh?: () => void;
}

function StatusBadge({ status }: { status: string }) {
  const getStatusClass = () => {
    if (status === "Failed") return "status-badge status-failed";
    if (status === "100%") return "status-badge status-complete";
    if (status.includes("%")) return "status-badge status-progress";
    return "status-badge status-complete";
  };

  return <span className={getStatusClass()}>{status}</span>;
}

export const RecordingsTable = React.forwardRef<HTMLDivElement, RecordingsTableProps>(
  ({ recordings, loading, onProcess, onRefresh }, ref) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [asrStreaming, setAsrStreaming] = useState(false);
  const [glossaryLang, setGlossaryLang] = useState<'zh' | 'ja'>("zh");

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedIds(new Set(recordings.map((r) => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
    setSelectAll(newSet.size === recordings.length);
  };

  const hasSelection = selectedIds.size > 0;

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;

    const count = selectedIds.size;
    if (!confirm(`確定要刪除 ${count} 個錄影檔嗎？此操作無法復原。`)) return;

    const idsToDelete = Array.from(selectedIds);
    let successCount = 0;
    let failCount = 0;

    for (const id of idsToDelete) {
      try {
        await deleteRecording(id, true);
        successCount++;
      } catch (e) {
        failCount++;
        console.error(`Failed to delete recording ${id}:`, e);
      }
    }

    // Clear selection
    setSelectedIds(new Set());
    setSelectAll(false);

    // Show result
    if (failCount === 0) {
      toast({
        title: '批量刪除成功',
        description: `已刪除 ${successCount} 個錄影檔`
      });
    } else {
      toast({
        title: '部分刪除失敗',
        description: `成功: ${successCount}, 失敗: ${failCount}`,
        variant: 'destructive'
      });
    }

    // Refresh list
    onRefresh?.();
  };

  return (
    <div ref={ref} className="card-elevated">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Recordings
            {hasSelection && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                (已選擇 {selectedIds.size} 個)
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
          <VideoUpload onUploadComplete={onRefresh} />
          {hasSelection && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBatchDelete}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              刪除 ({selectedIds.size})
            </Button>
          )}
          <Select value={glossaryLang} onValueChange={(v) => setGlossaryLang((v as 'zh'|'ja'))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="詞彙表語言" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="zh">中文詞彙表</SelectItem>
              <SelectItem value="ja">日文詞彙表</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={hasSelection ? "default" : "outline"}
            size="sm"
            onClick={() => onProcess?.(Array.from(selectedIds), asrStreaming, glossaryLang)}
            disabled={!hasSelection}
          >
            PROCESS
          </Button>
          </div>
        </div>
        {/* ASR Streaming Toggle */}
        <div className="flex items-center gap-2 mt-3">
          <Switch
            id="asr-streaming"
            checked={asrStreaming}
            onCheckedChange={setAsrStreaming}
          />
          <Label
            htmlFor="asr-streaming"
            className="text-sm text-muted-foreground cursor-pointer"
          >
            啟用串流模式 (Streaming Mode)
            <span className="ml-1 text-xs opacity-70">
              - 將音訊片段切成更小塊進行即時轉錄
            </span>
          </Label>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="w-12 px-6 py-3 text-left">
                <Checkbox
                  checked={selectAll}
                  onCheckedChange={handleSelectAll}
                  disabled={recordings.length === 0}
                />
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Name
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Date
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Size
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-muted-foreground">載入中...</p>
                  </div>
                </td>
              </tr>
            ) : recordings.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center">
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
                      尚無錄影檔
                    </p>
                    <p className="text-sm text-muted-foreground">
                      點擊上方「上傳錄影檔」按鈕開始上傳
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              recordings.map((recording, index) => (
                <tr
                  key={recording.id}
                  className={cn(
                    "table-row-hover border-b border-border last:border-b-0",
                    index % 2 === 0 ? "bg-card" : "bg-muted/30"
                  )}
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <td className="px-6 py-3">
                    <Checkbox
                      checked={selectedIds.has(recording.id)}
                      onCheckedChange={(checked) =>
                        handleSelectOne(recording.id, checked as boolean)
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-foreground">
                    {recording.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {recording.date}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {recording.length}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={recording.status} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="inline-flex items-center gap-2">
                      {recording.previewUrl ? (
                        <a
                          href={recording.previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 hover:bg-muted rounded-md transition-colors inline-flex"
                          title="預覽"
                        >
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        </a>
                      ) : (
                        <button className="p-1.5 hover:bg-muted rounded-md transition-colors" disabled>
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        </button>
                      )}
                      <button
                        className="p-1.5 hover:bg-destructive/10 rounded-md transition-colors"
                        title="刪除"
                        onClick={async () => {
                          if (!confirm(`確定刪除 ${recording.name} 嗎？`)) return;
                          try{
                            await deleteRecording(recording.id, true);
                            toast({ title: '已刪除', description: recording.name });
                            onRefresh?.();
                          }catch(e:any){
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
    </div>
  );
});

RecordingsTable.displayName = "RecordingsTable";
