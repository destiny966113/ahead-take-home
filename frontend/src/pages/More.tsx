import React from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

const MorePage: React.FC = () => {
  return (
    <DashboardLayout title="更多">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">快速連結：</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><a className="text-primary underline" href="/upload">批次上傳</a></li>
          <li><a className="text-primary underline" href="/jobs">任務清單</a></li>
          <li><a className="text-primary underline" href="/ai-video">AI 視訊後製</a></li>
          <li><a className="text-primary underline" href="/glossary">詞彙表管理</a></li>
        </ul>
      </div>
    </DashboardLayout>
  );
};

export default MorePage;

