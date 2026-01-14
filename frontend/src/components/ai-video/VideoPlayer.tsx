import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Maximize, Loader2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface VideoPlayerProps {
  videoUrl?: string | null;
  subtitleText?: string;
  subtitleHtml?: string;
  currentTime?: number;
  onTimeUpdate?: (time: number) => void;
  onSeek?: (time: number) => void;
  /** When seeking via externalCurrentTime, also start playback */
  autoPlayOnExternalSeek?: boolean;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function VideoPlayer({ 
  videoUrl, 
  subtitleText,
  subtitleHtml,
  currentTime: externalCurrentTime,
  onTimeUpdate,
  onSeek,
  autoPlayOnExternalSeek = true,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);
  // Removed smart jump throttle

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Apply external seek only when the delta is meaningful to avoid feedback loops.
  useEffect(() => {
    const v = videoRef.current;
    if (v == null || externalCurrentTime === undefined) return;
    const delta = Math.abs((v.currentTime || 0) - externalCurrentTime);
    // Small deltas usually come from our own onTimeUpdate; ignore to prevent stutter
    if (Number.isFinite(delta) && delta > 0.3) {
      setIsSeeking(true);
      v.currentTime = externalCurrentTime;
      if (autoPlayOnExternalSeek) {
        try {
          v.play();
          setIsPlaying(true);
        } catch {}
      }
      // Clear seeking shortly after to re-enable smart jumps
      const t = setTimeout(() => setIsSeeking(false), 300);
      return () => clearTimeout(t);
    }
  }, [externalCurrentTime]);

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    setCurrentTime(time);
    onTimeUpdate?.(time);

    // No smart auto-jump behavior
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
    setIsLoading(false);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.min(1, Math.max(0, x / rect.width));
    const newTime = percentage * duration;

    // Set seeking flag to prevent auto-jump during manual seek
    setIsSeeking(true);
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    onSeek?.(newTime);

    // Clear seeking flag after a short delay
    setTimeout(() => setIsSeeking(false), 500);
  };

  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.min(1, Math.max(0, x / rect.width));
    setHoverX(pct * rect.width);
    setHoverTime(pct * duration);
  };

  const clearProgressHover = () => {
    setHoverTime(null);
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleSkip = (seconds: number) => {
    if (!videoRef.current) return;
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Smart segment navigation removed

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const handleError = () => {
    setError('影片載入失敗');
    setIsLoading(false);
  };

  // Calculate smart progress (progress through course content only)
  const displayProgress = progress;

  return (
    <div className="bg-black rounded-xl overflow-hidden">
      {/* Video Area */}
      <div className="relative aspect-video bg-foreground/10 flex items-center justify-center">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            preload="auto"
            playsInline
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onWaiting={() => setIsLoading(true)}
            onCanPlay={() => setIsLoading(false)}
            onSeeking={() => setIsSeeking(true)}
            onSeeked={() => setTimeout(() => setIsSeeking(false), 300)}
            onError={handleError}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <p className="text-sm">無影片可顯示</p>
          </div>
        )}

        {/* Loading overlay */}
        {isLoading && videoUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {/* Subtitle overlay */}
        {(subtitleHtml || subtitleText) && (
          <div className="absolute bottom-20 left-0 right-0 flex justify-center px-4">
            <div className="bg-background/80 backdrop-blur-sm px-6 py-2 rounded-lg max-w-full">
              {subtitleHtml ? (
                <p className="text-foreground text-sm text-center" dangerouslySetInnerHTML={{ __html: subtitleHtml }} />
              ) : (
                <p className="text-foreground text-sm text-center">{subtitleText}</p>
              )}
            </div>
          </div>
        )}

        {/* Bottom gradient overlay for better control visibility */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/60 via-black/30 to-transparent pointer-events-none"></div>

        {/* Progress bar with hover time */}
        <div
          className="absolute bottom-16 left-4 right-4 cursor-pointer group z-10"
          onClick={handleProgressClick}
          onMouseMove={handleProgressHover}
          onMouseEnter={handleProgressHover}
          onMouseLeave={clearProgressHover}
        >
          <div className="h-2 bg-white/30 rounded-full group-hover:h-2.5 transition-all relative backdrop-blur-sm">
            {/* Hover marker */}
            {hoverTime !== null && (
              <div className="absolute -top-8" style={{ left: hoverX }}>
                <div className="translate-x-[-50%] bg-black/90 text-white text-xs px-2 py-1 rounded-md shadow-lg font-medium">
                  {formatTime(hoverTime)}
                </div>
              </div>
            )}
            <div
              className="h-full bg-primary rounded-full relative shadow-lg"
              style={{ width: `${displayProgress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-primary shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>
          </div>
        </div>

        {/* Time display */}
        <div className="absolute bottom-9 left-4 z-10">
          <div className="bg-black/80 backdrop-blur-sm px-2.5 py-1 rounded-md shadow-lg">
            <span className="text-white text-xs font-medium tracking-wide">
              {`${formatTime(currentTime)} / ${formatTime(duration)}`}
            </span>
          </div>
        </div>

        {/* Controls bar */}
        <div className="absolute bottom-2 left-4 right-4 flex items-center justify-between text-white z-10">
          <div className="flex items-center gap-2 bg-black/80 backdrop-blur-md rounded-lg px-3 py-2 shadow-lg">
            <button
              onClick={() => handleSkip(-10)}
              className="p-1.5 rounded-md hover:bg-white/20 active:bg-white/30 transition-all hover:scale-110"
              title="後退 10 秒"
            >
              <SkipBack className="w-5 h-5 drop-shadow-lg" />
            </button>
            <button
              onClick={handlePlayPause}
              className="p-2 rounded-md bg-primary/20 hover:bg-primary/40 active:bg-primary/50 transition-all hover:scale-110"
              disabled={!videoUrl}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 drop-shadow-lg" fill="currentColor" />
              ) : (
                <Play className="w-6 h-6 drop-shadow-lg" fill="currentColor" />
              )}
            </button>
            <button
              onClick={() => handleSkip(10)}
              className="p-1.5 rounded-md hover:bg-white/20 active:bg-white/30 transition-all hover:scale-110"
              title="前進 10 秒"
            >
              <SkipForward className="w-5 h-5 drop-shadow-lg" />
            </button>
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-white/20">
              <button
                onClick={toggleMute}
                className="p-1.5 rounded-md hover:bg-white/20 active:bg-white/30 transition-all hover:scale-110"
                title={isMuted ? "取消靜音" : "靜音"}
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5 drop-shadow-lg" />
                ) : (
                  <Volume2 className="w-5 h-5 drop-shadow-lg" />
                )}
              </button>
              <div className="w-20">
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.1}
                  onValueChange={handleVolumeChange}
                  className="cursor-pointer"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-black/80 backdrop-blur-md rounded-lg px-3 py-2 shadow-lg">
            <button
              onClick={handleFullscreen}
              className="p-1.5 rounded-md hover:bg-white/20 active:bg-white/30 transition-all hover:scale-110"
              disabled={!videoUrl}
              title="全螢幕"
            >
              <Maximize className="w-5 h-5 drop-shadow-lg" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
