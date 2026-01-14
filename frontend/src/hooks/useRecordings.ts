import { useState, useEffect } from "react";
// Supabase removed: fetch from backend API
import { useAuth } from "@/hooks/useAuth";

export interface Recording {
  id: string;
  name: string;
  date: string;
  length: string;
  status: string;
  filePath: string;
  fileSize: number;
}

export function useRecordings() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchRecordings = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/recordings`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const formatted: Recording[] = (data || []).map((rec: any) => ({
        id: rec.id,
        name: rec.name,
        date: rec.created_at ? new Date(rec.created_at).toLocaleDateString("zh-TW") : "",
        length: rec.duration ? `${Math.round(rec.duration)} 秒` : "無法獲取資訊",
        status: rec.status || 'uploaded',
        filePath: rec.file_path,
        fileSize: rec.file_size || 0,
      }));
      setRecordings(formatted);
    } catch (error) {
      console.error("Error fetching recordings:
", error);
      setRecordings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecordings(); }, []);

  const refetch = () => {
    setLoading(true);
    fetchRecordings();
  };

  return { recordings, loading, refetch };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
