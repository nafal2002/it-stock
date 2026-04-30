import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { Boxes, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Plus, TrendingUp, PieChart as PieChartIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KATEGORI } from "@/lib/constants";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line
} from "recharts";

type Item = Tables<"items">;
type Transaction = Tables<"transactions">;

interface DashboardTransaction extends Transaction {
  items: Pick<Item, "nama" | "kode"> | null;
}

export const Route = createFileRoute("/dashboard")({
  component: () => (
    <AppLayout>
      <DashboardContent />
    </AppLayout>
  ),
});

function DashboardContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const itemsChannel = (supabase.channel("dashboard-changes") as any)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items" },
        (payload: { eventType: string; new: any }) => {
          queryClient.invalidateQueries({ queryKey: ["items", user.id] });
          if (payload.eventType === "UPDATE") {
            const item = payload.new;
            if (item.qty <= 2) {
              toast.warning(`Stok Menipis: ${item.nama}`, {
                description: `Sisa stok: ${item.qty}`,
              });
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transactions" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["transactions", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(itemsChannel);
    };
  }, [user, queryClient]);

  const { data: items = [] } = useQuery({
    queryKey: ["items", user?.id],
    queryFn: async () => {
      try {
        // Fallback: If join fails, fetch items only to avoid app crash
        const { data, error } = await supabase.from("items").select("*").order("created_at", { ascending: false });
        if (error) throw error;

        // Attempt to fetch categories separately and merge manually if join fails
        const { data: cats } = await supabase.from("categories" as any).select("id, nama_kategori");
        
        return data.map((item: any) => ({
          ...item,
          categories: cats?.find((c: any) => c.id === item.category_id) || null
        }));
      } catch (e: any) {
        toast.error("Gagal memuat data barang: " + e.message);
        return [];
      }
    },
    enabled: !!user,
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("transactions")
          .select("*, items(nama, kode)")
          .order("created_at", { ascending: false })
          .limit(20);
        if (error) throw error;
        return data as DashboardTransaction[];
      } catch (e: any) {
        toast.error("Gagal memuat data transaksi: " + e.message);
        return [];
      }
    },
    enabled: !!user,
  });

  const totalItems = items.length;
  const totalQty = items.reduce((s: number, i: any) => s + (i.qty || 0), 0);
  const lowStock = items.filter((i: any) => i.qty <= 2).length;
  
  const byKat = useMemo(() => {
    // Dynamically build category summary from database categories
    const summary: Record<string, { value: number, count: number, color: string }> = {};
    
    items.forEach((i: any) => {
      const katName = i.categories?.nama_kategori || "Lain-lain";
      if (!summary[katName]) {
        summary[katName] = { value: 0, count: 0, color: "#" + Math.floor(Math.random()*16777215).toString(16) };
      }
      summary[katName].value += (i.qty || 0);
      summary[katName].count += 1;
    });

    return Object.entries(summary).map(([name, data]) => ({
      name,
      ...data
    })).sort((a, b) => b.value - a.value);
  }, [items]);

  // Data for trend chart (last 7 days transactions)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const trendData = last7Days.map(date => {
    const dayTxs = txs.filter((t: DashboardTransaction) => t.created_at.startsWith(date));
    return {
      date: new Date(date).toLocaleDateString("id-ID", { day: 'numeric', month: 'short' }),
      masuk: dayTxs.filter((t: DashboardTransaction) => t.tipe === "masuk").reduce((s: number, t: DashboardTransaction) => s + t.qty, 0),
      keluar: dayTxs.filter((t: DashboardTransaction) => t.tipe === "keluar").reduce((s: number, t: DashboardTransaction) => s + t.qty, 0),
    };
  });

  return (
    <div className="space-y-8 max-w-7xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-mono text-primary mb-1">// DASHBOARD</p>
          <h1 className="text-3xl font-display font-bold">Ringkasan Inventory</h1>
          <p className="text-muted-foreground text-sm mt-1">Pantau stok, kategori, dan transaksi terakhir secara real-time.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/items">
            <Button className="bg-primary text-primary-foreground hover:bg-primary-glow font-semibold">
              <Plus className="h-4 w-4 mr-2" /> Tambah Barang
            </Button>
          </Link>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Boxes} label="Jenis Barang" value={totalItems} />
        <StatCard icon={ArrowDownToLine} label="Total Stok" value={totalQty} accent />
        <StatCard icon={AlertTriangle} label="Stok Menipis" value={lowStock} warn={lowStock > 0} />
        <StatCard icon={ArrowUpFromLine} label="Aktivitas (20 Terakhir)" value={txs.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart: Stock by Category */}
        <div className="surface-card rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <PieChartIcon className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">Distribusi Stok per Kategori</h2>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byKat} layout="vertical" margin={{ left: 40, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.1)" />
                <XAxis type="number" stroke="#888" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="#888" fontSize={12} width={100} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="value" name="Jumlah Stok" radius={[0, 4, 4, 0]}>
                  {byKat.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart: Transaction Trend */}
        <div className="surface-card rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">Tren Transaksi (7 Hari Terakhir)</h2>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" stroke="#888" fontSize={12} />
                <YAxis stroke="#888" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                />
                <Line type="monotone" dataKey="masuk" name="Masuk" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="keluar" name="Keluar" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* recent tx */}
        <div className="surface-card rounded-xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Aktivitas Terakhir</h2>
            <Link to="/transactions" className="text-xs text-primary hover:underline font-mono">lihat semua →</Link>
          </div>
          {txs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Belum ada transaksi.</p>
          ) : (
            <div className="space-y-2">
              {txs.slice(0, 8).map((t: DashboardTransaction) => (
                <div key={t.id} className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${t.tipe === "masuk" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                    {t.tipe === "masuk" ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.items?.nama ?? "—"}</div>
                    <div className="text-xs text-muted-foreground font-mono">{t.items?.kode} · {new Date(t.created_at).toLocaleString("id-ID")}</div>
                  </div>
                  <div className={`text-sm font-mono font-semibold ${t.tipe === "masuk" ? "text-success" : "text-warning"}`}>
                    {t.tipe === "masuk" ? "+" : "-"}{t.qty}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* category summary */}
        <div className="surface-card rounded-xl p-6">
          <h2 className="font-display text-lg font-semibold mb-4">Ringkasan Kategori</h2>
          <div className="space-y-4">
            {byKat.map((k) => (
              <div key={k.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: k.color }} />
                  <span className="text-sm text-muted-foreground">{k.name}</span>
                </div>
                <div className="text-sm font-semibold">{k.value} unit</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent, warn }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; accent?: boolean; warn?: boolean }) {
  return (
    <div className={`surface-card rounded-xl p-5 ${warn ? "border-warning/40" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{label}</span>
        <Icon className={`h-4 w-4 ${warn ? "text-warning" : accent ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <div className={`font-display text-3xl font-bold ${accent ? "text-gradient" : warn ? "text-warning" : ""}`}>{value}</div>
    </div>
  );
}
