import { useEffect, useState } from "react";

export interface Recording {
  id: string;
  name: string;
  date: string;
  length: string;
  status: string;
  filePath: string;
  fileSize: number;
  previewUrl?: string;
}

export function useApiRecordings(){
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecordings = async () => {
    try{
      console.log('[useApiRecordings] 開始獲取 recordings...');
      setLoading(true);
      const res = await fetch(`/api/recordings`);
      console.log('[useApiRecordings] API response status:', res.status);
      if(!res.ok) throw new Error(await res.text());
      const data = await res.json();
      console.log('[useApiRecordings] 原始數據:', data);
      console.log('[useApiRecordings] 數據數量:', data?.length || 0);
      const mapped: Recording[] = (data || []).map((rec: any) => ({
        id: rec.id,
        name: rec.name,
        date: rec.created_at ? new Date(rec.created_at).toLocaleString('zh-TW', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' }) : '',
        length: rec.duration ? `${Math.round(rec.duration)} 秒` : '無法獲取資訊',
        status: rec.status || 'uploaded',
        filePath: rec.file_path,
        fileSize: rec.file_size || 0,
        previewUrl: rec.url || undefined,
      }))
      console.log('[useApiRecordings] 映射後的數據:', mapped);
      console.log('[useApiRecordings] 映射後數量:', mapped.length);
      setRecordings(mapped)
    }catch(e){
      console.error('[useApiRecordings] 錯誤:', e)
      setRecordings([])
    }finally{
      setLoading(false)
    }
  }

  useEffect(() => { fetchRecordings() }, [])

  const refetch = () => fetchRecordings()

  return { recordings, loading, refetch }
}
