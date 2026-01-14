import React, { useState, useCallback, useRef } from "react";
import { Upload, X, FileVideo, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ACCEPTED_VIDEO_TYPES = [
  "video/mp4",
  "video/mpeg",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
  "video/x-matroska",
];

const ACCEPTED_EXTENSIONS = ".mp4,.mpeg,.mpg,.mov,.avi,.webm,.mkv";
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

interface VideoUploadProps {
  onUploadComplete?: () => void;
}

type UploadState = "idle" | "selected" | "analyzing" | "uploading" | "success" | "error";

export function VideoUpload({ onUploadComplete }: VideoUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [videoDuration, setVideoDuration] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setSelectedFile(null);
    setUploadProgress(0);
    setUploadState("idle");
    setErrorMessage("");
    setVideoDuration(null);
    setIsDragging(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const validateFile = useCallback((file: File): string | null => {
    // Check file type
    if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
      return "不支援的檔案格式。請上傳 MP4, MPEG, MOV, AVI, WebM 或 MKV 格式的影片。";
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `檔案過大。最大允許大小為 500MB，您的檔案為 ${formatFileSize(file.size)}。`;
    }

    // Check if file is empty
    if (file.size === 0) {
      return "檔案為空，請選擇有效的影片檔案。";
    }

    return null;
  }, []);

  // Format duration from seconds to HH:MM:SS
  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Extract video duration from file
  const extractVideoDuration = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";

      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        if (video.duration && isFinite(video.duration)) {
          resolve(formatDuration(video.duration));
        } else {
          resolve("--:--:--");
        }
      };

      video.onerror = () => {
        window.URL.revokeObjectURL(video.src);
        resolve("--:--:--"); // Return placeholder instead of rejecting
      };

      video.src = URL.createObjectURL(file);
    });
  }, []);

  // Process file after selection
  const processSelectedFile = useCallback(async (file: File) => {
    setSelectedFile(file);
    setUploadState("analyzing");
    setErrorMessage("");

    try {
      const duration = await extractVideoDuration(file);
      setVideoDuration(duration);
      setUploadState("selected");
    } catch (error) {
      console.error("Error extracting duration:", error);
      setVideoDuration("--:--:--");
      setUploadState("selected");
    }
  }, [extractVideoDuration]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length === 0) return;

      const file = files[0];
      const error = validateFile(file);

      if (error) {
        setErrorMessage(error);
        setUploadState("error");
        toast({
          title: "檔案驗證失敗",
          description: error,
          variant: "destructive",
        });
        return;
      }

      processSelectedFile(file);
    },
    [validateFile, processSelectedFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      const error = validateFile(file);

      if (error) {
        setErrorMessage(error);
        setUploadState("error");
        toast({
          title: "檔案驗證失敗",
          description: error,
          variant: "destructive",
        });
        // Reset input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }

      processSelectedFile(file);
    },
    [validateFile, processSelectedFile]
  );

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const uploadFile = async () => {
    if (!selectedFile) {
      toast({
        title: "上傳失敗",
        description: "請先選擇檔案。",
        variant: "destructive",
      });
      return;
    }

    setUploadState("uploading");
    setUploadProgress(0);
    setErrorMessage("");

    try {
      console.log('[VideoUpload] 開始上傳到本地 API:', selectedFile.name);

      // Use XMLHttpRequest for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('files', selectedFile);

        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            console.log('[VideoUpload] 上傳進度:', progress + '%');
            setUploadProgress(progress);
          }
        });

        xhr.addEventListener("load", () => {
          console.log('[VideoUpload] 上傳完成, status:', xhr.status);
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              console.log('[VideoUpload] 上傳響應:', response);
              resolve();
            } catch (e) {
              console.error('[VideoUpload] 解析響應失敗:', e);
              resolve(); // Still resolve as upload succeeded
            }
          } else {
            let errorMsg = "上傳失敗";
            try {
              const response = JSON.parse(xhr.responseText);
              errorMsg = response.detail || response.message || response.error || errorMsg;
            } catch {
              errorMsg = `上傳失敗 (錯誤碼: ${xhr.status})`;
            }
            console.error('[VideoUpload] 上傳失敗:', errorMsg);
            reject(new Error(errorMsg));
          }
        });

        xhr.addEventListener("error", () => {
          console.error('[VideoUpload] 網路錯誤');
          reject(new Error("網路錯誤，請檢查您的網路連線後重試。"));
        });

        xhr.addEventListener("abort", () => {
          console.warn('[VideoUpload] 上傳取消');
          reject(new Error("上傳已取消。"));
        });

        xhr.addEventListener("timeout", () => {
          console.error('[VideoUpload] 上傳逾時');
          reject(new Error("上傳逾時，請重試。"));
        });

        xhr.open("POST", "/api/jobs/upload");
        xhr.timeout = 600000; // 10 minutes timeout
        console.log('[VideoUpload] 發送請求到 /api/jobs/upload');
        xhr.send(formData);
      });

      setUploadState("success");
      toast({
        title: "上傳成功",
        description: `${selectedFile.name} 已成功上傳。`,
      });

      console.log('[VideoUpload] 上傳成功，3秒後關閉對話框');
      // Delay close to show success state
      setTimeout(() => {
        setIsOpen(false);
        resetState();
        onUploadComplete?.();
      }, 1500);
    } catch (error: any) {
      console.error('[VideoUpload] 上傳錯誤:', error);
      const message = error.message || "上傳過程中發生錯誤，請稍後再試。";
      setErrorMessage(message);
      setUploadState("error");
      toast({
        title: "上傳失敗",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (uploadState === "uploading" || uploadState === "analyzing") {
      // Prevent closing while uploading or analyzing
      return;
    }
    setIsOpen(open);
    if (!open) {
      resetState();
    }
  };

  const handleSelectClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setUploadState("idle");
    setErrorMessage("");
    setVideoDuration(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm">
          <Upload className="w-4 h-4 mr-2" />
          上傳錄影檔
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>上傳錄影檔</DialogTitle>
          <DialogDescription>從您的電腦選擇或拖放影片檔案上傳。</DialogDescription>
        </DialogHeader>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Upload states */}
        {uploadState === "idle" || uploadState === "error" ? (
          <div className="space-y-4">
            {/* Dropzone */}
            <div
              className={cn("dropzone cursor-pointer", isDragging && "active")}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleSelectClick}
            >
              <FileVideo className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-foreground font-medium mb-2">
                拖放影片檔案至此處
              </p>
              <p className="text-muted-foreground text-sm mb-4">
                或點擊此區域選擇檔案
              </p>
              <p className="text-muted-foreground text-xs">
                支援 MP4, MPEG, MOV, AVI, WebM, MKV（最大 500MB）
              </p>
            </div>

            {/* Error message */}
            {uploadState === "error" && errorMessage && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Select button */}
            <div className="flex justify-center">
              <Button variant="outline" onClick={handleSelectClick}>
                從電腦選擇檔案
              </Button>
            </div>
          </div>
        ) : uploadState === "analyzing" ? (
          <div className="space-y-4">
            {/* File info with analyzing indicator */}
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <FileVideo className="w-10 h-10 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">
                  {selectedFile?.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedFile && formatFileSize(selectedFile.size)}
                </p>
              </div>
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>正在分析影片資訊...</span>
            </div>
          </div>
        ) : uploadState === "selected" ? (
          <div className="space-y-4">
            {/* File info with duration */}
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <FileVideo className="w-10 h-10 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">
                  {selectedFile?.name}
                </p>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>{selectedFile && formatFileSize(selectedFile.size)}</span>
                  {videoDuration && (
                    <>
                      <span className="text-border">•</span>
                      <span>時長: {videoDuration}</span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={handleRemoveFile}
                className="p-1 hover:bg-background rounded-md transition-colors"
                aria-label="移除檔案"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                取消
              </Button>
              <Button onClick={uploadFile}>開始上傳</Button>
            </div>
          </div>
        ) : uploadState === "uploading" ? (
          <div className="space-y-4">
            {/* File info */}
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <FileVideo className="w-10 h-10 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">
                  {selectedFile?.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedFile && formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">上傳中...</span>
                <span className="font-medium text-foreground">
                  {uploadProgress}%
                </span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>

            {/* Cancel button */}
            <div className="flex justify-end">
              <Button variant="outline" disabled>
                上傳中...
              </Button>
            </div>
          </div>
        ) : uploadState === "success" ? (
          <div className="flex flex-col items-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-lg font-medium text-foreground mb-2">上傳成功！</p>
            <p className="text-sm text-muted-foreground text-center">
              {selectedFile?.name} 已成功上傳
            </p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
