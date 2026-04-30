import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import * as React from "react";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Terminal, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) nav({ to: "/dashboard" });
  }, [user, loading, nav]);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    
    // Hardcoded credentials nafal / nafal123
    if (username === "nafal" && password === "nafal123") {
      // Map username 'nafal' to your specific email nafalmf@gmail.com
      const email = "nafalmf@gmail.com";
      
      // Try to sign in
      let { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      
      if (signInError) {
        // If user doesn't exist or email not confirmed
        if (signInError.message.includes("Invalid login credentials")) {
          toast.error("User nafalmf@gmail.com belum terdaftar di Supabase atau password salah.");
        } else if (signInError.message.includes("Email not confirmed")) {
          toast.error("Email belum dikonfirmasi. Silakan cek inbox nafalmf@gmail.com atau matikan 'Confirm Email' di Supabase Dashboard.");
        } else {
          toast.error("Login Error: " + signInError.message);
        }
      } else {
        toast.success("Selamat datang, Nafal!");
      }
    } else {
      toast.error("Username atau Password salah!");
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center glow">
            <Terminal className="h-5 w-5 text-primary" />
          </div>
          <span className="font-display text-xl font-bold">ITStock<span className="text-primary">.</span></span>
        </Link>

        <div className="surface-card rounded-2xl p-8">
          <h2 className="text-2xl font-display font-bold text-center mb-6">Login Sistem</h2>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input id="username" type="text" required value={username} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)} placeholder="Masukkan username" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} placeholder="Masukkan password" />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-primary text-primary-foreground hover:bg-primary-glow font-semibold">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Masuk"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
