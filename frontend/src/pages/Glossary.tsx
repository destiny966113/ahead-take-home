import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlossaryManagement } from "@/components/ai-video/GlossaryManagement";
import { toast } from "@/hooks/use-toast";
import { uploadGlossary, getGlossaryInfo } from "@/lib/api";

const GlossaryPage: React.FC = () => {
  const [glossaryMeta, setGlossaryMeta] = useState({
    fileName: "",
    uploadTime: "",
    entryCount: 0,
  });

  const [jpGlossaryMeta, setJpGlossaryMeta] = useState({
    fileName: "",
    uploadTime: "",
    entryCount: 0,
  });

  // 載入詞彙表資訊
  const loadGlossaryInfo = async () => {
    try {
      const [zhRes, jaRes] = await Promise.all([
        getGlossaryInfo('zh'),
        getGlossaryInfo('ja'),
      ]);
      if (zhRes.success && zhRes.glossary) {
        const uploadTime = zhRes.glossary.upload_time
          ? new Date(zhRes.glossary.upload_time).toLocaleString("zh-TW")
          : "";
        setGlossaryMeta({
          fileName: zhRes.glossary.filename || "",
          uploadTime,
          entryCount: zhRes.glossary.entry_count || 0,
        });
      }
      if (jaRes.success && jaRes.glossary) {
        const uploadDate = jaRes.glossary.upload_time
          ? new Date(jaRes.glossary.upload_time).toLocaleString("zh-TW")
          : "";
        setJpGlossaryMeta({
          fileName: jaRes.glossary.filename || "",
          uploadTime: uploadDate,
          entryCount: jaRes.glossary.entry_count || 0,
        });
      }
    } catch (error) {
      console.error("載入詞彙表資訊失敗:", error);
    }
  };

  // 頁面載入時獲取資訊
  useEffect(() => {
    loadGlossaryInfo();
  }, []);

  const handleGlossaryUpload = async (file: File) => {
    try {
      // 上傳檔案到後端
      const res = await uploadGlossary(file, 'zh');
      if (!res.success) throw new Error('上傳失敗');
      await loadGlossaryInfo();
      toast({ title: "詞彙表已更新", description: `成功新增 ${res.stats.entry_count} 個詞彙` });
    } catch (error) {
      console.error("上傳詞彙表失敗:", error);
      toast({
        title: "上傳失敗",
        description: error instanceof Error ? error.message : "未知錯誤",
        variant: "destructive"
      });
    }
  };

  const handleGlossaryUploadJa = async (file: File) => {
    try {
      const res = await uploadGlossary(file, 'ja');
      if (!res.success) throw new Error('上傳失敗');
      await loadGlossaryInfo();
      toast({ title: "日文詞彙表已更新", description: `成功新增 ${res.stats.entry_count} 個詞彙` });
    } catch (error) {
      console.error("上傳日文詞彙表失敗:", error);
      toast({ title: "上傳失敗", description: error instanceof Error ? error.message : "未知錯誤", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout title="詞彙表管理">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlossaryManagement glossary={glossaryMeta} onUpload={handleGlossaryUpload} lang="zh" title="中文詞彙表管理" />
        <GlossaryManagement glossary={jpGlossaryMeta} onUpload={handleGlossaryUploadJa} lang="ja" title="日文詞彙表管理" />
      </div>
    </DashboardLayout>
  );
};

export default GlossaryPage;
