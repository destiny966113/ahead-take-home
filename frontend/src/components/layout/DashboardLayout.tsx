import React from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
}

export const DashboardLayout = React.forwardRef<HTMLDivElement, DashboardLayoutProps>(
  ({ children, title }, ref) => {
    return (
      <div ref={ref} className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header title={title} />
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    );
  }
);

DashboardLayout.displayName = "DashboardLayout";
