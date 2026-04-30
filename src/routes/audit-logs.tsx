import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import * as React from "react";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { History, Search, FileJson, Clock, Package, Trash2, Edit, PlusCircle, ArrowLeftRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Tables } from "@/integrations/supabase/types";

type AuditLog = Tables<"audit_logs">;
type Item = Tables<"items">;

interface AuditLogWithItem extends AuditLog {
  items: Pick<Item, "nama" | "kode"> | null;
}

export const Route = createFileRoute("/audit-logs")({
  component: () => (
    <AppLayout>
      <AuditLogsPage />
    </AppLayout>
  ),
});

function AuditLogsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit_logs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*, items(nama, kode)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AuditLogWithItem[];
    },
    enabled: !!user,
  });

  const filteredLogs = useMemo(() => {
    if (!search) return logs;
    const m = search.toLowerCase();
    return logs.filter((l) => 
      l.action.toLowerCase().includes(m) || 
      l.items?.nama?.toLowerCase().includes(m) || 
      l.items?.kode?.toLowerCase().includes(m)
    );
  }, [logs, search]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case "created": return <PlusCircle className="h-4 w-4 text-success" />;
      case "updated": return <Edit className="h-4 w-4 text-primary" />;
      case "deleted": return <Trash2 className="h-4 w-4 text-destructive" />;
      case "transaction": return <ArrowLeftRight className="h-4 w-4 text-warning" />;
      default: return <History className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "created": return "Tambah Barang";
      case "updated": return "Edit Barang";
      case "deleted": return "Hapus Barang";
      case "transaction": return "Transaksi Stok";
      default: return action;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <p className="text-xs font-mono text-primary mb-1">// SYSTEM AUDIT</p>
        <h1 className="text-3xl font-display font-bold">Audit Log</h1>
        <p className="text-muted-foreground text-sm mt-1">Lacak setiap perubahan data dan aktivitas transaksi dalam sistem.</p>
      </div>

      <div className="flex items-center gap-4 bg-surface/50 p-4 rounded-xl border border-border/50">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Cari berdasarkan aksi atau nama barang..." 
            className="pl-10"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="surface-card rounded-xl overflow-hidden border border-border/50 shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-elevated border-b border-border">
              <tr className="text-left font-mono text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Aksi</th>
                <th className="px-4 py-3">Barang / Aset</th>
                <th className="px-4 py-3 text-right">Detail Data</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="py-20 text-center text-muted-foreground">Memuat data log...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={4} className="py-20 text-center text-muted-foreground">Tidak ada log aktivitas ditemukan.</td></tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="border-b border-border/30 hover:bg-surface-elevated/50 group transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <div className="font-mono text-[11px] font-semibold whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString("id-ID")}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action)}
                        <span className="font-medium text-xs uppercase tracking-wider">{getActionLabel(log.action)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {log.items ? (
                        <div className="flex items-center gap-2">
                          <Package className="h-3.5 w-3.5 text-primary" />
                          <div>
                            <div className="font-semibold">{log.items.nama}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">{log.items.kode}</div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic text-xs">Aset telah dihapus / ID: {log.item_id?.slice(0, 8)}...</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 gap-2 font-mono text-[10px]">
                            <FileJson className="h-3.5 w-3.5" /> LIHAT JSON
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <History className="h-5 w-5 text-primary" />
                              Audit Log Detail
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground uppercase">Data Lama (Old)</Label>
                                <pre className="bg-black/90 text-success-foreground p-4 rounded-lg overflow-auto max-h-[300px] text-[10px] font-mono border border-border/50 shadow-inner">
                                  {JSON.stringify(log.old_data, null, 2)}
                                </pre>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground uppercase">Data Baru (New)</Label>
                                <pre className="bg-black/90 text-primary-foreground p-4 rounded-lg overflow-auto max-h-[300px] text-[10px] font-mono border border-border/50 shadow-inner">
                                  {JSON.stringify(log.new_data, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
