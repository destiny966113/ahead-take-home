import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";

const emailSchema = z.string().trim().email({ message: "請輸入有效的電子郵件地址" });
const passwordSchema = z.string().min(6, { message: "密碼至少需要 6 個字元" });
const displayNameSchema = z.string().trim().min(1, { message: "請輸入顯示名稱" }).max(50, { message: "顯示名稱不能超過 50 個字元" });

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; displayName?: string }>({});

  const { signIn, signUp, user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string; displayName?: string } = {};

    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }

    if (!isLogin) {
      const displayNameResult = displayNameSchema.safeParse(displayName);
      if (!displayNameResult.success) {
        newErrors.displayName = displayNameResult.error.errors[0].message;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "登入失敗",
              description: "電子郵件或密碼錯誤",
              variant: "destructive",
            });
          } else {
            toast({
              title: "登入失敗",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "登入成功",
            description: "歡迎回來！",
          });
          navigate("/");
        }
      } else {
        const { error } = await signUp(email, password, displayName);
        if (error) {
          if (error.message.includes("User already registered")) {
            toast({
              title: "註冊失敗",
              description: "此電子郵件已被註冊",
              variant: "destructive",
            });
          } else {
            toast({
              title: "註冊失敗",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "註冊成功",
            description: "註冊成功！",
          });
          navigate("/");
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">載入中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sidebar/20 to-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full bg-sidebar flex items-center justify-center mb-4 border-4 border-sidebar-foreground/30">
            <svg
              viewBox="0 0 40 40"
              className="w-10 h-10 text-sidebar-foreground"
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
          <h1 className="text-2xl font-bold text-foreground">OMIP Parser</h1>
        </div>

        {/* Auth Card */}
        <div className="card-elevated p-8">
          <h2 className="text-xl font-semibold text-foreground text-center mb-6">
            {isLogin ? "登入帳號" : "註冊帳號"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="displayName">顯示名稱</Label>
                <Input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="您的名稱"
                  className={errors.displayName ? "border-destructive" : ""}
                />
                {errors.displayName && (
                  <p className="text-sm text-destructive">{errors.displayName}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">電子郵件</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密碼</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={errors.password ? "border-destructive" : ""}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "處理中..." : isLogin ? "登入" : "註冊"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setErrors({});
              }}
              className="text-sm text-primary hover:underline"
            >
              {isLogin ? "還沒有帳號？點此註冊" : "已有帳號？點此登入"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
