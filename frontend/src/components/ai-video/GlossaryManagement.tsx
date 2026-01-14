import React, { useState, useCallback, useEffect } from "react";
import { Upload, X, Check, Info, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getGlossaryWords, addGlossaryWord, deleteGlossaryWord, deleteAllGlossaryWords } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

interface GlossaryInfo {
  fileName: string | null;
  uploadTime: string | null;
  entryCount: number | null;
}

interface GlossaryManagementProps {
  glossary: GlossaryInfo;
  onUpload?: (file: File) => Promise<void>;
  onWordsChange?: () => void;
  lang?: 'zh' | 'ja';
  title?: string;
}

export const GlossaryManagement = React.forwardRef<HTMLDivElement, GlossaryManagementProps>(
  ({ glossary, onUpload, onWordsChange, lang = 'zh', title }, ref) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [words, setWords] = useState<string[]>([]);
  const [newWord, setNewWord] = useState("");
  const [isAddingWord, setIsAddingWord] = useState(false);
  const [showWordsList, setShowWordsList] = useState(true); // Default to expanded
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Load words on mount and when lang changes
  useEffect(() => {
    loadWords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const loadWords = async () => {
    try {
      const res = await getGlossaryWords(lang);
      if (res.success) {
        setWords(res.words);
      }
    } catch (err) {
      console.error("Failed to load words:", err);
    }
  };

  const handleAddWord = async () => {
    if (!newWord.trim()) {
      toast({
        title: "請輸入詞彙",
        description: "詞彙不能為空",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsAddingWord(true);
      const res = await addGlossaryWord(newWord.trim(), lang);
      if (res.success) {
        setWords([...words, newWord.trim()]);
        setNewWord("");
        toast({
          title: "詞彙已新增",
          description: `已新增詞彙：${newWord.trim()}`,
        });
        onWordsChange?.();
      }
    } catch (err: any) {
      toast({
        title: "新增失敗",
        description: err?.message || "請稍後重試",
        variant: "destructive",
      });
    } finally {
      setIsAddingWord(false);
    }
  };

  const handleDeleteWord = async (word: string) => {
    try {
      const res = await deleteGlossaryWord(word, lang);
      if (res.success) {
        setWords(words.filter((w) => w !== word));
        toast({
          title: "詞彙已刪除",
          description: `已刪除詞彙：${word}`,
        });
        onWordsChange?.();
      }
    } catch (err: any) {
      toast({
        title: "刪除失敗",
        description: err?.message || "請稍後重試",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAllWords = async () => {
    try {
      setIsDeletingAll(true);
      const res = await deleteAllGlossaryWords(lang);
      if (res.success) {
        setWords([]);
        toast({
          title: "全部詞彙已刪除",
          description: `已刪除 ${res.deleted_count} 個詞彙`,
        });
        onWordsChange?.();
      }
    } catch (err: any) {
      toast({
        title: "刪除失敗",
        description: err?.message || "請稍後重試",
        variant: "destructive",
      });
    } finally {
      setIsDeletingAll(false);
      setShowDeleteAllDialog(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith(".csv")) {
        await simulateUpload(file);
      }
    },
    [onUpload]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        await simulateUpload(file);
      }
    },
    [onUpload]
  );

  const simulateUpload = async (file: File) => {
    setUploadProgress(0);
    for (let i = 0; i <= 100; i += 10) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      setUploadProgress(i);
    }
    await onUpload?.(file);
    setUploadProgress(null);
    setUploadSuccess(true);
    setTimeout(() => {
      setIsModalOpen(false);
      setUploadSuccess(false);
      loadWords(); // Reload words after upload
    }, 1500);
  };

    return (
      <>
        <div ref={ref} className="card-elevated">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{title || '詞彙表管理'}</h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Stats */}
          <div className="space-y-2">
            <div className="flex text-sm">
              <span className="text-muted-foreground w-28">最新上傳檔案：</span>
              <span className="font-medium text-foreground">
                {glossary.fileName || "-"}
              </span>
            </div>
            <div className="flex text-sm">
              <span className="text-muted-foreground w-28">上傳時間：</span>
              <span className="font-medium text-foreground">
                {glossary.uploadTime || "-"}
              </span>
            </div>
            <div className="flex text-sm">
              <span className="text-muted-foreground w-28">詞彙數量：</span>
              <span className="font-medium text-foreground">
                {words.length}
              </span>
            </div>
          </div>

          {/* Add Word Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                placeholder="輸入新詞彙..."
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddWord();
                  }
                }}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleAddWord}
                disabled={isAddingWord || !newWord.trim()}
              >
                <Plus className="w-4 h-4 mr-1" />
                新增
              </Button>
            </div>
          </div>

          {/* Words List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">詞彙列表</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteAllDialog(true)}
                  disabled={words.length === 0}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  全部刪除
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowWordsList(!showWordsList)}
                >
                  {showWordsList ? "收起" : "展開"}
                </Button>
              </div>
            </div>

            {showWordsList && (
              <ScrollArea className="h-64 border rounded-md">
                <div className="p-4 space-y-2">
                  {words.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      尚無詞彙，請上傳檔案或手動新增
                    </p>
                  ) : (
                    words.map((word, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md group"
                      >
                        <span className="text-sm text-foreground">{word}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteWord(word)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              * 提醒：詞彙庫的更新僅在未來的處理任務中生效。
            </p>
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsModalOpen(true)}
            >
              上傳檔案
            </Button>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>上傳詞彙表</DialogTitle>
            <DialogDescription>
              支援 CSV、Excel (xlsx/xls) 或純文字 (txt) 格式。
            </DialogDescription>
          </DialogHeader>
          <div
            className={cn("dropzone", isDragging && "active")}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {uploadProgress !== null ? (
              <div className="space-y-4">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-sm text-muted-foreground">上傳中...</p>
              </div>
            ) : (
              <>
                <p className="text-foreground font-medium mb-2">
                  拖放檔案至此處
                </p>
                <p className="text-muted-foreground mb-4">或</p>
                <label>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,.txt"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <Button variant="outline" asChild>
                    <span className="cursor-pointer">
                      從電腦選擇檔案
                    </span>
                  </Button>
                </label>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete All Confirmation Dialog */}
      <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要刪除全部詞彙嗎？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作將刪除所有 {words.length} 個詞彙，且無法復原。確定要繼續嗎？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAll}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAllWords}
              disabled={isDeletingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingAll ? "刪除中..." : "確定刪除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});

GlossaryManagement.displayName = "GlossaryManagement";
