import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Pencil, Check, X, Clock, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface SubtitleSegment {
  id: string;
  startTime?: number;
  endTime?: number;
  speaker?: string;
  text: string;
  classification?: string;
}

export interface SubtitleEditorRef {
  scrollTo: (scrollTop: number) => void;
  getScrollInfo: () => { scrollTop: number; scrollHeight: number; clientHeight: number } | null;
}

interface SubtitleEditorProps {
  segments: SubtitleSegment[];
  currentTime?: number;
  onSave?: (segments: SubtitleSegment[]) => void;
  onSegmentClick?: (segment: SubtitleSegment) => void;
  // Scroll sync hooks
  onScroll?: (scrollTop: number, scrollHeight: number, clientHeight: number) => void;
  scrollSyncEnabled?: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getClassificationColor(classification?: string): string {
  switch (classification) {
    case '正課內容':
      return 'bg-primary/10 border-primary/30';
    case '笑話雜談':
      return 'bg-secondary/50 border-secondary';
    default:
      return 'bg-muted border-border';
  }
}

export const SubtitleEditor = forwardRef<SubtitleEditorRef, SubtitleEditorProps>(
  ({
    segments: initialSegments,
    currentTime,
    onSave,
    onSegmentClick,
    onScroll,
    scrollSyncEnabled,
  }, ref) => {
  const [segments, setSegments] = useState(initialSegments);
  // Keep internal state in sync when parent updates segments (e.g., after async load)
  useEffect(() => {
    setSegments(initialSegments);
  }, [initialSegments]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const handleEdit = (segment: SubtitleSegment) => {
    setEditingId(segment.id);
    setEditText(segment.text);
  };

  const handleSaveEdit = (id: string) => {
    const updatedSegments = segments.map(s =>
      s.id === id ? { ...s, text: editText } : s
    );
    setSegments(updatedSegments);
    setEditingId(null);
    setEditText("");
    onSave?.(updatedSegments);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  // Determine active segment based on current time
  const activeSegmentId = currentTime !== undefined
    ? segments.find(s =>
        s.startTime !== undefined &&
        s.endTime !== undefined &&
        currentTime >= s.startTime &&
        currentTime <= s.endTime
      )?.id
    : null;

  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rootRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    scrollTo: (scrollTop: number) => {
      const vp = viewportRef.current;
      if (vp) {
        vp.scrollTop = scrollTop;
      }
    },
    getScrollInfo: () => {
      const vp = viewportRef.current;
      if (!vp) return null;
      return {
        scrollTop: vp.scrollTop,
        scrollHeight: vp.scrollHeight,
        clientHeight: vp.clientHeight,
      };
    },
  }));

  useEffect(() => {
    if (!activeSegmentId) return;
    const el = itemRefs.current[activeSegmentId];
    if (el && el.scrollIntoView){
      try { el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch {}
    }
  }, [activeSegmentId]);

  // Locate Radix ScrollArea viewport once mounted
  useEffect(() => {
    const r = rootRef.current;
    if (!r) return;
    const vp = r.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
    if (vp) viewportRef.current = vp;
  }, []);

  // Report scroll position
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp || !onScroll || !scrollSyncEnabled) return;
    const handler = () => {
      onScroll(vp.scrollTop, vp.scrollHeight, vp.clientHeight);
    };
    vp.addEventListener('scroll', handler, { passive: true });
    return () => { vp.removeEventListener('scroll', handler as any); };
  }, [onScroll, scrollSyncEnabled]);

  if (segments.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-foreground">字幕編輯器</h3>
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">暫無字幕內容</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" ref={rootRef}>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">字幕編輯器</h3>
        <span className="text-xs text-muted-foreground">
          共 {segments.length} 段
        </span>
      </div>
      
      <ScrollArea className="h-[480px] pr-4">
        <div className="space-y-3">
          {segments.map((segment, idx) => (
            <div 
              key={segment.id} 
              ref={(el)=>{ itemRefs.current[segment.id] = el; }}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                getClassificationColor(segment.classification)
              } ${activeSegmentId === segment.id ? 'ring-2 ring-primary' : ''}`}
              onClick={() => onSegmentClick?.(segment)}
            >
              {/* Header with time and classification */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">片段 #{idx+1}</span>
                  {segment.startTime !== undefined && segment.endTime !== undefined && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(segment.startTime)} - {formatTime(segment.endTime)}</span>
                    </div>
                  )}
                  {segment.speaker && (
                    <span className="text-xs text-muted-foreground">
                      • {segment.speaker}
                    </span>
                  )}
                </div>
                {segment.classification && (
                  <Badge 
                    variant={segment.classification === '正課內容' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {segment.classification}
                  </Badge>
                )}
              </div>

              {/* Text content */}
              {editingId === segment.id ? (
                <div className="flex items-start gap-2">
                  <Input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="flex-1 text-sm"
                    autoFocus
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveEdit(segment.id);
                    }}
                    className="p-2 hover:bg-primary/10 rounded-md transition-colors text-primary"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelEdit();
                    }}
                    className="p-2 hover:bg-muted rounded-md transition-colors text-muted-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-sm text-foreground leading-relaxed">
                    {segment.text}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(segment);
                    }}
                    className="p-2 hover:bg-muted rounded-md transition-colors shrink-0"
                  >
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
});

SubtitleEditor.displayName = 'SubtitleEditor';
