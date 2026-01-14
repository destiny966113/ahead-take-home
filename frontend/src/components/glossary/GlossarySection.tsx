import React, { useState, useCallback } from "react";
import { X, Upload, Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface GlossaryInfo {
  title: string | null;
  date: string | null;
  entryCount: number | null;
}

interface GlossarySectionProps {
  glossary: GlossaryInfo;
  onPreview?: () => void;
  onUpload?: (file: File) => Promise<void>;
}

export const GlossarySection = React.forwardRef<HTMLDivElement, GlossarySectionProps>(
  ({ glossary, onPreview, onUpload }, ref) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

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
    // Simulate upload progress
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
    }, 1500);
  };

  const hasGlossary = glossary.title !== null;

    return (
      <>
        <div ref={ref} className="card-elevated">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-foreground">Glossary</h2>
            {uploadSuccess && (
              <div className="flex items-center gap-2 bg-success-light text-success px-3 py-1.5 rounded-full text-sm font-medium animate-fade-in">
                <Check className="w-4 h-4" />
                Glossary updated successfully.
                <button className="ml-1 hover:text-success/80">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <div className="flex items-center gap-8 text-sm">
            <div>
              <span className="text-muted-foreground">Glossary title: </span>
              <span className="font-medium text-foreground">
                {glossary.title || "-"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Glossary date: </span>
              <span className="font-medium text-foreground">
                {glossary.date || "-"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Entry count: </span>
              <span className="font-medium text-foreground">
                {glossary.entryCount ?? "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="w-4 h-4" />
              <span>Glossary updates take effect only on future processing jobs.</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={onPreview}
                disabled={!hasGlossary}
              >
                PREVIEW CURRENT
              </Button>
              <Button
                variant="success"
                size="sm"
                onClick={() => setIsModalOpen(true)}
              >
                UPLOAD NEW
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload glossary CSV</DialogTitle>
            <DialogDescription>
              Drop or select a CSV file to upload your glossary.
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
                <p className="text-sm text-muted-foreground">
                  Uploading in progress
                </p>
              </div>
            ) : (
              <>
                <p className="text-foreground font-medium mb-2">
                  Drop a file here
                </p>
                <p className="text-muted-foreground mb-4">Or</p>
                <label>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <Button variant="outline" asChild>
                    <span className="cursor-pointer">
                      SELECT A FILE FROM YOUR COMPUTER
                    </span>
                  </Button>
                </label>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

GlossarySection.displayName = "GlossarySection";
