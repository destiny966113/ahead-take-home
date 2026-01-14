import { Home, Grid3X3, Video, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation, useNavigate } from "react-router-dom";

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
}

const navItems: NavItem[] = [
  { icon: <Home className="w-5 h-5" />, label: "首頁", path: "/" },
  { icon: <Video className="w-5 h-5" />, label: "AI後製", path: "/ai-video" },
  { icon: <Grid3X3 className="w-5 h-5" />, label: "詞彙表", path: "/glossary" },
  { icon: <MoreHorizontal className="w-5 h-5" />, label: "更多", path: "/more" },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="w-24 min-h-screen bg-sidebar flex flex-col items-center py-6">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 rounded-full bg-sidebar-foreground/20 flex items-center justify-center mb-2 border-2 border-sidebar-foreground/30">
          <svg
            viewBox="0 0 40 40"
            className="w-8 h-8 text-sidebar-foreground"
            fill="currentColor"
          >
            <circle cx="20" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <path
              d="M8 34 C8 24, 32 24, 32 34"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M14 20 Q20 26 26 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <span className="text-sidebar-foreground font-bold text-sm tracking-wide">
          OMIP
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-2 w-full px-3">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => item.path && navigate(item.path)}
            className={cn(
              "sidebar-nav-item text-sidebar-foreground",
              isActive(item.path) && "active"
            )}
          >
            {item.icon}
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
