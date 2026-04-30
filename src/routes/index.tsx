import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Boxes, ShieldCheck, Activity, Search, ArrowRight, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && user) nav({ to: "/dashboard" });
  }, [user, loading, nav]);

  return (
    <div className="min-h-screen">
      {/* nav */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-40 bg-background/70">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center glow">
              <Terminal className="h-5 w-5 text-primary" />
            </div>
            <span className="font-display text-lg font-bold">ITStock<span className="text-primary">.</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/auth"><Button variant="ghost" size="sm">Masuk</Button></Link>
            <Link to="/auth"><Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary-glow">Mulai</Button></Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="container mx-auto px-6 py-20 md:py-32 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-mono text-primary mb-8">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          v1.0 — Sistem Inventory IT Support
        </div>
        <h1 className="text-5xl md:text-7xl font-display font-bold leading-tight mb-6">
          Stok IT lo<br />
          <span className="text-gradient">selalu rapi & terkontrol.</span>
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground mb-10">
          Catat CCTV, kabel, RAM, sparepart, sampai tools teknisi. Tracking masuk-keluar, lokasi rak, dan stok real-time — tanpa Excel berantakan.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link to="/auth">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary-glow font-semibold glow">
              Buka Dashboard <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* features */}
      <section className="container mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Boxes, title: "Manajemen Barang", desc: "Kode, kategori, merk, qty, lokasi rak. Kategori siap pakai: CCTV, Networking, Peripheral, dll." },
            { icon: Activity, title: "Tracking Masuk/Keluar", desc: "Catat barang masuk & keluar. Stok update otomatis. Tau dipasang di mana." },
            { icon: Search, title: "Pencarian Cepat", desc: "Filter by kategori, kondisi, lokasi. Stok rendah langsung kelihatan." },
          ].map((f) => (
            <div key={f.title} className="surface-card rounded-xl p-6 hover:border-primary/40 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/50 py-8 text-center text-xs text-muted-foreground font-mono">
        <ShieldCheck className="inline h-3 w-3 mr-1" /> Data lo aman — login pribadi, isolasi per user.
      </footer>
    </div>
  );
}
