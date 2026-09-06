"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
export function AccountStatus() {
  const [user, setUser] = useState<{ email?: string; display_name?: string } | null>(null);
  useEffect(() => { const supabase = getBrowserSupabase(); if (!supabase) return; supabase.auth.getUser().then(({ data }: { data: { user: { email?: string; user_metadata?: { display_name?: string } } | null } }) => setUser(data.user ? { email: data.user.email, display_name: data.user.user_metadata?.display_name } : null)); const { data: sub } = supabase.auth.onAuthStateChange((_e: string, session: { user: { email?: string; user_metadata?: { display_name?: string } } | null } | null) => setUser(session?.user ? { email: session.user.email, display_name: session.user.user_metadata?.display_name } : null)); return () => sub.subscription.unsubscribe(); }, []);
  const logout = async () => { const supabase = getBrowserSupabase(); await supabase?.auth.signOut(); };
  if (!getBrowserSupabase()) return <div className="account-links"><Link href="/auth/login">Log In</Link><Link href="/auth/sign-up">Create Account</Link></div>;
  return user ? <div className="account-links"><Link href="/account">{user.display_name || user.email || "Account"}</Link><button type="button" onClick={logout}>Log Out</button></div> : <div className="account-links"><Link href="/auth/login">Log In</Link><Link href="/auth/sign-up">Create Account</Link></div>;
}
