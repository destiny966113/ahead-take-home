import { Play, Clock, Tag } from "lucide-react";
import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Badge } from "@/components/ui/badge";

export interface VideoClip {
  id: string;
  clipNumber: number;
  startTime: string;
  endTime: string;
  startSec?: number;
  endSec?: number;
  duration?: number;
  transcript?: string;
  transcriptHtml?: string;
  classification?: string;
}

export interface VideoClipsListRef {
  scrollTo: (scrollTop: number) => void;
  getScrollInfo: () => { scrollTop: number; scrollHeight: number; clientHeight: number } | null;
}

interface VideoClipsListProps {
  clips: VideoClip[];
  selectedClipId?: string;
  onClipSelect?: (clip: VideoClip) => void;
  onClipPlay?: (clip: VideoClip) => void;
  currentTime?: number;
  // Scroll sync hooks
  onScroll?: (scrollTop: number, scrollHeight: number, clientHeight: number) => void;
  scrollSyncEnabled?: boolean;
}

function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getClassificationBadgeVariant(classification: string): "default" | "secondary" | "destructive" | "outline" {
  switch (classification) {
    case '正課內容':
      return 'default';
    case '笑話雜談':
      return 'secondary';
    default:
      return 'outline';
  }
}

export const VideoClipsList = forwardRef<VideoClipsListRef, VideoClipsListProps>(
  ({ clips, selectedClipId, onClipSelect, onClipPlay, currentTime, onScroll, scrollSyncEnabled }, ref) => {
  // Determine active clip by current time
  const activeClipId = (currentTime !== undefined)
    ? (clips.find(c => c.startSec !== undefined && c.endSec !== undefined && currentTime >= (c.startSec as number) && currentTime <= (c.endSec as number))?.id || undefined)
    : undefined;

  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const listRef = useRef<HTMLDivElement | null>(null);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    scrollTo: (scrollTop: number) => {
      if (listRef.current) {
        listRef.current.scrollTop = scrollTop;
      }
    },
    getScrollInfo: () => {
      if (!listRef.current) return null;
      return {
        scrollTop: listRef.current.scrollTop,
        scrollHeight: listRef.current.scrollHeight,
        clientHeight: listRef.current.clientHeight,
      };
    },
  }));

  useEffect(() => {
    const idToScroll = selectedClipId || activeClipId;
    if (!idToScroll) return;
    const el = itemRefs.current[idToScroll];
    if (el && el.scrollIntoView) {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {}
    }
  }, [selectedClipId, activeClipId]);

  const handleScroll = () => {
    const container = listRef.current;
    if (!container || !onScroll || !scrollSyncEnabled) return;
    onScroll(container.scrollTop, container.scrollHeight, container.clientHeight);
  };

  if (clips.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-foreground">後置影片切片</h3>
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">暫無影片片段</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-foreground">後置影片切片</h3>
      <div ref={listRef} onScroll={handleScroll} className="space-y-3 h-[480px] overflow-y-auto pr-2" id="clips-scroll">
        {clips.map((clip) => (
          <div 
            key={clip.id} 
            ref={(el)=>{ itemRefs.current[clip.id] = el; }}
            className={`p-3 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
              (selectedClipId === clip.id || activeClipId === clip.id)
                ? 'border-primary bg-primary/5' 
                : 'border-border bg-card hover:border-primary/50'
            }`}
            onClick={() => onClipSelect?.(clip)}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  片段 #{clip.clipNumber}
                </span>
                {clip.classification && (
                  <Badge variant={getClassificationBadgeVariant(clip.classification)} className="text-xs">
                    {clip.classification}
                  </Badge>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClipPlay?.(clip);
                }}
                className="p-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                title="播放此片段"
              >
                <Play className="w-3 h-3" fill="currentColor" />
              </button>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Clock className="w-3 h-3" />
              <span>{clip.startTime} → {clip.endTime}</span>
              {clip.duration !== undefined && (
                <span className="text-muted-foreground/60">
                  ({formatSeconds(clip.duration)})
                </span>
              )}
            </div>

            {clip.transcriptHtml ? (
              <p className="text-xs text-foreground/80 line-clamp-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: clip.transcriptHtml }} />
            ) : clip.transcript ? (
              <p className="text-xs text-foreground/80 line-clamp-2 leading-relaxed">{clip.transcript}</p>
            ) : null}
          </div>
        ))}
      </div>
      
      {/* Summary */}
      <div className="pt-2 border-t border-border">
        <p className="text-xs text-muted-foreground">
          共 {clips.length} 個片段
        </p>
      </div>
    </div>
  );
});

VideoClipsList.displayName = 'VideoClipsList';
