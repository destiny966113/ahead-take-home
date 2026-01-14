import React, { useState, useEffect, createContext, useContext, ReactNode } from "react";

// Lightweight guest-only auth context (Supabase removed)
export interface User { id: string; email?: string | null }
export interface Session { user: User | null }

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user] = useState<User | null>(null);
  const [session] = useState<Session | null>({ user: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // No auth; mark as ready
    setLoading(false);
  }, []);

  const signUp = async (_email: string, _password: string, _displayName: string) => ({ error: null as any });
  const signIn = async (_email: string, _password: string) => ({ error: null as any });
  const signOut = async () => {};

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
