import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import * as React from "react";
import { useState, useMemo, type FormEvent, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ArrowDownToLine, ArrowUpFromLine, Download, FileSpreadsheet, Calendar as CalendarIcon, Filter, FileText } from "lucide-react";
import { toast } from "sonner";
import { exportToCSV, exportToExcel, todayStamp } from "@/lib/export";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Tables } from "@/integrations/supabase/types";

type Transaction = Tables<"transactions">;
type Item = Tables<"items">;

interface TransactionWithItem extends Transaction {
  items: Pick<Item, "nama" | "kode"> | null;
}

export const Route = createFileRoute("/transactions")({
  component: () => (
    <AppLayout>
      <TransactionsPage />
    </AppLayout>
  ),
});

const today = () => new Date().toISOString().slice(0, 10);

function formatDateID(d: string) {
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

function TransactionsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filterTipe, setFilterTipe] = useState<string>("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = (supabase.channel("transactions-page-changes") as any)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        () => {
          qc.invalidateQueries({ queryKey: ["transactions", user.id] });
          qc.invalidateQueries({ queryKey: ["items", user.id] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items" },
        () => {
          qc.invalidateQueries({ queryKey: ["transactions", user.id] });
          qc.invalidateQueries({ queryKey: ["items", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const { data: txs = [] } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*, items(nama, kode)")
        .order("tanggal", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as TransactionWithItem[];
    },
    enabled: !!user,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["items", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("items").select("id, kode, nama, qty").order("nama");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    return txs.filter((t: TransactionWithItem) => {
      if (filterTipe !== "all" && t.tipe !== filterTipe) return false;
      const tgl = t.tanggal ?? t.created_at?.slice(0, 10);
      if (filterFrom && tgl < filterFrom) return false;
      if (filterTo && tgl > filterTo) return false;
      return true;
    });
  }, [txs, filterTipe, filterFrom, filterTo]);

  const totalMasuk = filtered.filter((t: TransactionWithItem) => t.tipe === "masuk").reduce((s: number, t: TransactionWithItem) => s + t.qty, 0);
  const totalKeluar = filtered.filter((t: TransactionWithItem) => t.tipe === "keluar").reduce((s: number, t: TransactionWithItem) => s + t.qty, 0);

  const buildRows = (data: TransactionWithItem[]) => data.map((t: TransactionWithItem) => {
    const tgl = t.tanggal ?? t.created_at?.slice(0, 10);
    return {
      Tanggal: formatDateID(tgl),
      "Tanggal (ISO)": tgl,
      Tipe: t.tipe.toUpperCase(),
      "Kode Barang": t.items?.kode ?? "",
      "Nama Barang": t.items?.nama ?? "",
      Qty: t.qty,
      "Dipasang Di / Diberikan Ke": t.dipasang_di ?? "",
      Keterangan: t.keterangan ?? "",
      "Dicatat Pada": new Date(t.created_at).toLocaleString("id-ID"),
    };
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between flex-wrap gap-4 no-print">
        <div>
          <p className="text-xs font-mono text-primary mb-1">// TRANSACTIONS</p>
          <h1 className="text-3xl font-display font-bold">Transaksi Masuk &amp; Keluar</h1>
          <p className="text-muted-foreground text-sm mt-1">Catat barang masuk dari supplier atau keluar untuk dipasang. Pastikan tanggal terisi benar untuk laporan akurat.</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={filtered.length === 0}>
                <Download className="h-4 w-4 mr-2" /> Unduh Laporan
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                exportToCSV(buildRows(filtered), `transaksi-${todayStamp()}`);
                toast.success("Laporan CSV diunduh");
              }}><FileSpreadsheet className="h-4 w-4 mr-2" /> Format CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                const all = buildRows(filtered);
                const masuk = all.filter((r: { Tipe: string }) => r.Tipe === "MASUK");
                const keluar = all.filter((r: { Tipe: string }) => r.Tipe === "KELUAR");
                exportToExcel([
                  { name: "Semua Transaksi", rows: all },
                  { name: "Barang Masuk", rows: masuk },
                  { name: "Barang Keluar", rows: keluar },
                ], `transaksi-${todayStamp()}`);
                toast.success("Laporan Excel diunduh");
              }}><FileSpreadsheet className="h-4 w-4 mr-2" /> Format Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrint}>
                <FileText className="h-4 w-4 mr-2" /> Format PDF (Cetak)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog open={open} onOpenChange={(v: boolean) => setOpen(v)}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary-glow font-semibold">
                <Plus className="h-4 w-4 mr-2" /> Catat Transaksi
              </Button>
            </DialogTrigger>
            <TxForm items={items} onClose={() => setOpen(false)} onDone={() => qc.invalidateQueries()} />
          </Dialog>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 no-print">
        <div className="surface-card rounded-xl p-4">
          <p className="text-xs font-mono text-muted-foreground">// TOTAL TRANSAKSI</p>
          <p className="text-2xl font-display font-bold mt-1">{filtered.length}</p>
        </div>
        <div className="surface-card rounded-xl p-4 border-l-2 border-success">
          <p className="text-xs font-mono text-success">// MASUK</p>
          <p className="text-2xl font-display font-bold mt-1 text-success">+{totalMasuk}</p>
        </div>
        <div className="surface-card rounded-xl p-4 border-l-2 border-warning">
          <p className="text-xs font-mono text-warning">// KELUAR</p>
          <p className="text-2xl font-display font-bold mt-1 text-warning">−{totalKeluar}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="surface-card rounded-xl p-4 no-print">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-primary" />
          <p className="text-xs font-mono text-muted-foreground uppercase">Filter Laporan</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Tipe</Label>
            <Select value={filterTipe} onValueChange={setFilterTipe}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="masuk">Barang Masuk</SelectItem>
                <SelectItem value="keluar">Barang Keluar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Dari Tanggal</Label>
            <Input type="date" value={filterFrom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Sampai Tanggal</Label>
            <Input type="date" value={filterTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" className="w-full" onClick={() => { setFilterTipe("all"); setFilterFrom(""); setFilterTo(""); }}>
              Reset Filter
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="surface-card rounded-xl overflow-hidden print-container" ref={printRef}>
        <div className="p-8 hidden print:block">
          <h1 className="text-2xl font-bold mb-2">Laporan Transaksi Inventory</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Periode: {filterFrom || "Awal"} s/d {filterTo || "Sekarang"} | 
            Tipe: {filterTipe === "all" ? "Semua" : filterTipe.toUpperCase()}
          </p>
          <div className="grid grid-cols-3 gap-4 mb-6 border p-4 rounded-lg">
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Transaksi</p>
              <p className="text-lg font-bold">{filtered.length}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-success">Total Masuk</p>
              <p className="text-lg font-bold text-success">+{totalMasuk}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-warning">Total Keluar</p>
              <p className="text-lg font-bold text-warning">−{totalKeluar}</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-elevated border-b border-border">
              <tr className="text-left font-mono text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Tipe</th>
                <th className="px-4 py-3">Barang</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3">Dipasang Di / Catatan</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">Belum ada transaksi sesuai filter.</td></tr>
              )}
              {filtered.map((t: TransactionWithItem) => {
                const tgl = t.tanggal ?? t.created_at?.slice(0, 10);
                return (
                  <tr key={t.id} className="border-b border-border/30 hover:bg-surface-elevated/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-3.5 w-3.5 text-primary no-print" />
                        <div>
                          <div className="font-mono text-xs font-semibold">{formatDateID(tgl)}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">dicatat: {new Date(t.created_at).toLocaleString("id-ID")}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border font-mono ${
                        t.tipe === "masuk" ? "bg-success/10 text-success border-success/30" : "bg-warning/10 text-warning border-warning/30"
                      }`}>
                        <span className="no-print">
                          {t.tipe === "masuk" ? <ArrowDownToLine className="h-3 w-3" /> : <ArrowUpFromLine className="h-3 w-3" />}
                        </span>
                        {t.tipe.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{t.items?.nama}</div>
                      <div className="text-xs text-muted-foreground font-mono">{t.items?.kode}</div>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-bold ${t.tipe === "masuk" ? "text-success" : "text-warning"}`}>
                      {t.tipe === "masuk" ? "+" : "−"}{t.qty}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {t.dipasang_di && <div className="text-foreground">{t.dipasang_di}</div>}
                      {t.keterangan && <div className="text-xs">{t.keterangan}</div>}
                      {!t.dipasang_di && !t.keterangan && "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-container, .print-container * { visibility: visible; }
          .print-container { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .surface-card { border: 1px solid #eee !important; background: white !important; color: black !important; }
          th { background: #f8f8f8 !important; color: black !important; }
          td { border-bottom: 1px solid #eee !important; color: black !important; }
          .text-primary { color: black !important; }
          .text-success { color: #10b981 !important; }
          .text-warning { color: #f59e0b !important; }
          .bg-success/10 { background: transparent !important; }
          .bg-warning/10 { background: transparent !important; }
        }
      `}</style>
    </div>
  );
}

interface ItemOption { id: string; kode: string; nama: string; qty: number }

function TxForm({ items, onClose, onDone }: { items: ItemOption[]; onClose: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const [tipe, setTipe] = useState<"masuk" | "keluar">("masuk");
  const [tanggal, setTanggal] = useState(today());
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [dipasang, setDipasang] = useState("");
  const [keterangan, setKeterangan] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!user || !itemId) throw new Error("Pilih barang dulu");
      if (!tanggal) throw new Error("Tanggal wajib diisi");
      const q = parseInt(qty);
      if (q < 1) throw new Error("Qty harus > 0");
      const item = items.find((i) => i.id === itemId);
      if (tipe === "keluar" && item && q > item.qty) throw new Error(`Stok tidak cukup (tersedia: ${item.qty})`);
      const { data: newTx, error } = await supabase.from("transactions").insert({
        user_id: user.id,
        item_id: itemId,
        tipe,
        qty: q,
        tanggal,
        dipasang_di: dipasang.trim() || null,
        keterangan: keterangan.trim() || null,
      }).select().single();

      if (error) throw error;

      // Log to audit_logs
      await supabase.from("audit_logs").insert({
        action: "transaction",
        item_id: itemId,
        user_id: user.id,
        old_data: { prev_qty: item?.qty },
        new_data: { ...newTx, current_qty: tipe === "masuk" ? (item?.qty || 0) + q : (item?.qty || 0) - q }
      });
    },
    onSuccess: () => {
      toast.success(`Transaksi tercatat untuk ${formatDateID(tanggal)} — stok diupdate`);
      onDone();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = (e: FormEvent) => { e.preventDefault(); create.mutate(); };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-display">Catat Transaksi</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setTipe("masuk")}
            className={`p-3 rounded-lg border text-sm font-semibold transition-all ${tipe === "masuk" ? "border-success bg-success/10 text-success" : "border-border text-muted-foreground hover:border-border"}`}>
            <ArrowDownToLine className="h-4 w-4 mx-auto mb-1" /> Barang Masuk
          </button>
          <button type="button" onClick={() => setTipe("keluar")}
            className={`p-3 rounded-lg border text-sm font-semibold transition-all ${tipe === "keluar" ? "border-warning bg-warning/10 text-warning" : "border-border text-muted-foreground hover:border-border"}`}>
            <ArrowUpFromLine className="h-4 w-4 mx-auto mb-1" /> Barang Keluar
          </button>
        </div>

        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <Label className="flex items-center gap-2 text-primary">
            <CalendarIcon className="h-4 w-4" /> Tanggal Transaksi <span className="text-destructive">*</span>
          </Label>
          <Input type="date" value={tanggal} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTanggal(e.target.value)} required max={today()} className="mt-2" />
          <p className="text-[11px] text-muted-foreground mt-1.5 font-mono">
            {tanggal ? `→ ${formatDateID(tanggal)}` : "Pilih tanggal kejadian (hari/bulan/tahun)"}
          </p>
        </div>

        <div>
          <Label>Barang <span className="text-destructive">*</span></Label>
          <Select value={itemId} onValueChange={(v: string) => setItemId(v)}>
            <SelectTrigger><SelectValue placeholder="Pilih barang..." /></SelectTrigger>
            <SelectContent>
              {items.map((i: ItemOption) => (
                <SelectItem key={i.id} value={i.id}>
                  <span className="font-mono text-xs text-primary mr-2">{i.kode}</span>
                  {i.nama} <span className="text-muted-foreground">· stok: {i.qty}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Qty <span className="text-destructive">*</span></Label>
          <Input type="number" min={1} value={qty} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQty(e.target.value)} required />
        </div>
        {tipe === "keluar" && (
          <div>
            <Label>Dipasang Di / Diberikan Ke</Label>
            <Input value={dipasang} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDipasang(e.target.value)} placeholder="Mis. Kantor Lt 2, PC Pak Budi" />
          </div>
        )}
        <div>
          <Label>Keterangan</Label>
          <Textarea value={keterangan} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setKeterangan(e.target.value)} rows={2} placeholder="Opsional — supplier, no. PO, kondisi, dll" />
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={create.isPending} className="bg-primary text-primary-foreground hover:bg-primary-glow">
            {create.isPending ? "Menyimpan..." : "Simpan Transaksi"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
