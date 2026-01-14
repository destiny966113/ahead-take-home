import { useState, useRef, useEffect } from "react";
import { Play, Clock, Pencil, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

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

export interface SubtitleSegment {
  id: string;
  startTime?: number;
  endTime?: number;
  speaker?: string;
  text: string;
  classification?: string;
}

interface SyncedClipsSubtitlesProps {
  clips: VideoClip[];
  segments: SubtitleSegment[];
  currentTime?: number;
  selectedClipId?: string;
  onClipSelect?: (clip: VideoClip) => void;
  onClipPlay?: (clip: VideoClip) => void;
  onSegmentClick?: (segment: SubtitleSegment) => void;
  onSaveSubtitles?: (segments: SubtitleSegment[]) => void;
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

export function SyncedClipsSubtitles({
  clips,
  segments: initialSegments,
  currentTime,
  selectedClipId,
  onClipSelect,
  onClipPlay,
  onSegmentClick,
  onSaveSubtitles,
}: SyncedClipsSubtitlesProps) {
  const [segments, setSegments] = useState(initialSegments);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setSegments(initialSegments);
  }, [initialSegments]);

  // Determine active clip/segment by current time
  const activeClipId = currentTime !== undefined
    ? clips.find(c =>
        c.startSec !== undefined &&
        c.endSec !== undefined &&
        currentTime >= c.startSec &&
        currentTime <= c.endSec
      )?.id
    : undefined;

  const activeSegmentId = currentTime !== undefined
    ? segments.find(s =>
        s.startTime !== undefined &&
        s.endTime !== undefined &&
        currentTime >= s.startTime &&
        currentTime <= s.endTime
      )?.id
    : null;

  // Auto-scroll to active item
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
    onSaveSubtitles?.(updatedSegments);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  if (clips.length === 0 && segments.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">暫無內容</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <h3 className="text-base font-semibold text-foreground">後置影片切片</h3>
        <h3 className="text-base font-semibold text-foreground">字幕編輯器</h3>
      </div>

      <ScrollArea className="h-[480px]">
        <div className="space-y-3 pr-4">
          {clips.map((clip, idx) => {
            const segment = segments[idx];
            const isActive = selectedClipId === clip.id || activeClipId === clip.id;
            const isSegmentActive = activeSegmentId === segment?.id;

            return (
              <div
                key={clip.id}
                ref={(el) => { itemRefs.current[clip.id] = el; }}
                className="grid grid-cols-2 gap-4"
              >
                {/* Clip Card */}
                <div
                  className={`p-3 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
                    isActive
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

                {/* Subtitle Card */}
                {segment ? (
                  <div
                    className={`p-3 rounded-lg border transition-all cursor-pointer ${
                      getClassificationColor(segment.classification)
                    } ${isSegmentActive ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => onSegmentClick?.(segment)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">片段 #{idx + 1}</span>
                        {segment.startTime !== undefined && segment.endTime !== undefined && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>{formatSeconds(segment.startTime)} - {formatSeconds(segment.endTime)}</span>
                          </div>
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
                ) : (
                  <div className="p-3 rounded-lg border border-border bg-muted/50 flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">無對應字幕</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="pt-2 border-t border-border">
        <p className="text-xs text-muted-foreground">
          共 {clips.length} 個片段
        </p>
      </div>
    </div>
  );
}
