import React, { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface RecordingFile {
  id: string;
  name: string;
  date: string;
  duration: string;
  previewUrl?: string;
}

interface RecordingListTableProps {
  recordings: RecordingFile[];
  onProcess?: (selectedIds: string[]) => void;
}

export const RecordingListTable = React.forwardRef<HTMLDivElement, RecordingListTableProps>(
  ({ recordings, onProcess }, ref) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date");

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedIds(new Set(filteredRecordings.map((r) => r.id)));
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
    setSelectAll(newSet.size === filteredRecordings.length);
  };

  const filteredRecordings = recordings.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const hasSelection = selectedIds.size > 0;

  return (
    <div ref={ref} className="card-elevated flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">錄影檔列表</h2>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-border">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-sm text-muted-foreground">搜尋</span>
          <div className="relative flex-1 max-w-md">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder=""
              className="h-8 text-sm"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">排序方式：日期</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-border">
              <th className="w-12 px-6 py-3 text-left">
                <Checkbox
                  checked={selectAll}
                  onCheckedChange={handleSelectAll}
                />
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                會議名稱
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                會議日期
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                錄影時長
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">預覽</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecordings.map((recording, index) => (
              <tr
                key={recording.id}
                className={cn(
                  "border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors"
                )}
              >
                <td className="px-6 py-3">
                  <Checkbox
                    checked={selectedIds.has(recording.id)}
                    onCheckedChange={(checked) =>
                      handleSelectOne(recording.id, checked as boolean)
                    }
                  />
                </td>
                <td className="px-4 py-3 text-sm text-foreground">
                  {recording.name}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {recording.date}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {recording.duration}
                </td>
                <td className="px-4 py-3 text-center">
                  {recording.previewUrl ? (
                    <a href={recording.previewUrl} target="_blank" rel="noreferrer" className="text-link text-sm">
                      開啟
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">無</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-4 px-6 py-4 border-t border-border">
        <span className="text-sm text-muted-foreground">
          已選擇 {selectedIds.size} 項
        </span>
        <Button
          variant="default"
          size="sm"
          onClick={() => onProcess?.(Array.from(selectedIds))}
          disabled={!hasSelection}
        >
          確認執行
        </Button>
      </div>
    </div>
  );
});

RecordingListTable.displayName = "RecordingListTable";
