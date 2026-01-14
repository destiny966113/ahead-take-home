import { Bell, LogIn, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "已登出",
      description: "您已成功登出",
    });
    navigate("/auth");
  };

  const getInitials = () => {
    if (!user) return "G"; // Guest
    const email = user.email || "";
    return email.charAt(0).toUpperCase();
  };

  return (
    <header className="flex items-center justify-between px-8 py-4 bg-card border-b border-border">
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      
      <div className="flex items-center gap-4">
        {/* VIP Badge */}
        <Badge variant="vip" className="font-semibold">
          ADM
        </Badge>

        {/* Notifications */}
        <button className="relative p-2 hover:bg-muted rounded-lg transition-colors">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
        </button>

        {/* Avatar with Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="focus:outline-none">
              <Avatar className="w-10 h-10 border-2 border-border cursor-pointer hover:border-primary transition-colors">
                <AvatarImage src="" />
                <AvatarFallback className="bg-muted text-muted-foreground font-medium">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {user ? (
              <>
                <DropdownMenuItem className="text-muted-foreground text-sm">
                  {user.email}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer">
                  <LogOut className="w-4 h-4 mr-2" />
                  登出
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onClick={() => navigate('/auth')} className="cursor-pointer">
                <LogIn className="w-4 h-4 mr-2" />
                登入
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
