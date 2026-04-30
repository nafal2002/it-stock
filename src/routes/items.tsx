import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import * as React from "react";
import { useState, type FormEvent, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search, Download, FileSpreadsheet, Image as ImageIcon, FilterX, ZoomIn, Info, ArrowLeftRight, Calendar as CalendarIcon, ArrowDownToLine, ArrowUpFromLine, ArrowRight } from "lucide-react";
import { KONDISI, type Kondisi } from "@/lib/constants";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { exportToCSV, exportToExcel, todayStamp } from "@/lib/export";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ImageUpload } from "@/components/ImageUpload";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination";

export const Route = createFileRoute("/items")({
  component: () => (
    <AppLayout>
      <ItemsPage />
    </AppLayout>
  ),
});

type Item = Tables<"items">;
type ItemImage = Tables<"item_images">;

interface ItemRow extends Item {
  item_images?: Pick<ItemImage, "url" | "is_primary">[];
  categories?: { nama_kategori: string } | null;
}

function ItemsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterKat, setFilterKat] = useState<string>("all");
  const [filterKon, setFilterKon] = useState<string>("all");
  const [filterStok, setFilterStok] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ItemRow | null>(null);
  const [transactionItem, setTransactionItem] = useState<ItemRow | null>(null);
  const [zoomImg, setZoomImg] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = (supabase.channel("items-page-changes") as any)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items" },
        () => {
          qc.invalidateQueries({ queryKey: ["items", user.id] });
          qc.invalidateQueries({ queryKey: ["transactions", user.id] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        () => {
          qc.invalidateQueries({ queryKey: ["items", user.id] });
          qc.invalidateQueries({ queryKey: ["transactions", user.id] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "item_images" },
        () => {
          qc.invalidateQueries({ queryKey: ["items", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const { data: items = [] } = useQuery({
    queryKey: ["items", user?.id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("items")
          .select("*")
          .order("kode");
        if (error) throw error;

        // Fetch related data separately to handle schema cache issues
        const { data: images } = await supabase.from("item_images").select("url, is_primary, item_id");
        const { data: cats } = await supabase.from("categories" as any).select("id, nama_kategori");

        return data.map((item: any) => ({
          ...item,
          item_images: images?.filter((img: any) => img.item_id === item.id) || [],
          categories: cats?.find((c: any) => c.id === item.category_id) || null
        }));
      } catch (e: any) {
        toast.error("Gagal mengambil data barang: " + e.message);
        return [];
      }
    },
    enabled: !!user,
  });

  const { data: dbCategories = [] } = useQuery({
    queryKey: ["categories", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories" as any).select("id, nama_kategori").is("deleted_at", null);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      try {
        const { data: imgs } = await supabase.from("item_images").select("url").eq("item_id", id);
        if (imgs && imgs.length > 0) {
          const paths = imgs.map((img: { url: string }) => img.url.split("/").pop()).filter(Boolean) as string[];
          if (paths.length > 0) {
            await supabase.storage.from("item-images").remove(paths);
          }
        }
        
        const { error } = await supabase.from("items").delete().eq("id", id);
        if (error) throw error;

        await supabase.from("audit_logs").insert({
          action: "deleted",
          item_id: null,
          user_id: user?.id,
          old_data: items.find((i: ItemRow) => i.id === id) as any,
          new_data: null
        });
      } catch (e: any) {
        throw new Error("Gagal menghapus barang: " + e.message);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success("Barang dihapus");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    return items.filter((i: ItemRow) => {
      const m = search.toLowerCase();
      const okSearch = !m || i.nama.toLowerCase().includes(m) || i.kode.toLowerCase().includes(m) || (i.merk ?? "").toLowerCase().includes(m);
      const okKat = filterKat === "all" || i.category_id === filterKat;
      const okKon = filterKon === "all" || i.kondisi === filterKon;
      
      let okStok = true;
      if (filterStok === "ready") okStok = i.qty > 0;
      else if (filterStok === "empty") okStok = i.qty === 0;
      else if (filterStok === "low") okStok = i.qty > 0 && i.qty <= 2;

      return okSearch && okKat && okKon && okStok;
    });
  }, [items, search, filterKat, filterKon, filterStok]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterKat, filterKon, filterStok]);

  const resetFilters = () => {
    setSearch("");
    setFilterKat("all");
    setFilterKon("all");
    setFilterStok("all");
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-mono text-primary mb-1">// INVENTORY</p>
          <h1 className="text-3xl font-display font-bold">Daftar Barang</h1>
          <p className="text-muted-foreground text-sm mt-1">Manajemen aset dan stok barang IT secara real-time.</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={items.length === 0}>
                <Download className="h-4 w-4 mr-2" /> Unduh Laporan
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                const rows = items.map((i: ItemRow) => ({
                  Kode: i.kode, Nama: i.nama,
                  Kategori: i.categories?.nama_kategori || "Lain-lain",
                  Merk: i.merk ?? "", Qty: i.qty, "Lokasi Rak": i.lokasi_rak ?? "",
                  Kondisi: KONDISI.find((k) => k.value === i.kondisi)?.label ?? i.kondisi,
                  Catatan: i.catatan ?? "",
                }));
                exportToCSV(rows, `inventory-${todayStamp()}`);
                toast.success("Laporan CSV diunduh");
              }}><FileSpreadsheet className="h-4 w-4 mr-2" /> Format CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                const rows = items.map((i: ItemRow) => ({
                  Kode: i.kode, Nama: i.nama,
                  Kategori: i.categories?.nama_kategori || "Lain-lain",
                  Merk: i.merk ?? "", Qty: i.qty, "Lokasi Rak": i.lokasi_rak ?? "",
                  Kondisi: KONDISI.find((k) => k.value === i.kondisi)?.label ?? i.kondisi,
                  Catatan: i.catatan ?? "",
                }));
                exportToExcel([{ name: "Inventory", rows }], `inventory-${todayStamp()}`);
                toast.success("Laporan Excel diunduh");
              }}><FileSpreadsheet className="h-4 w-4 mr-2" /> Format Excel (.xlsx)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog open={open} onOpenChange={(v: boolean) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary-glow font-semibold">
                <Plus className="h-4 w-4 mr-2" /> Tambah Barang
              </Button>
            </DialogTrigger>
            <ItemForm
              item={editing}
              onClose={() => { setOpen(false); setEditing(null); }}
              existingItems={items}
              dbCategories={dbCategories}
            />
          </Dialog>
        </div>
      </div>

      {/* filters */}
      <div className="flex gap-3 flex-wrap items-end bg-surface-card p-4 rounded-xl border border-border/50 shadow-sm">
        <div className="flex-1 min-w-[240px] space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase font-mono">Pencarian Lanjut</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Cari kode, nama, atau merk..." 
              className="pl-10 bg-background/50" 
              value={search} 
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} 
            />
          </div>
        </div>
        <div className="w-[200px] space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase font-mono">Kategori</Label>
          <Select value={filterKat} onValueChange={setFilterKat}>
            <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              {dbCategories.map((k) => <SelectItem key={k.id} value={k.id}>{k.nama_kategori}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[150px] space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase font-mono">Status Stok</Label>
          <Select value={filterStok} onValueChange={setFilterStok}>
            <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Stok</SelectItem>
              <SelectItem value="ready">Tersedia</SelectItem>
              <SelectItem value="low">Menipis (≤2)</SelectItem>
              <SelectItem value="empty">Habis</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-[150px] space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase font-mono">Kondisi</Label>
          <Select value={filterKon} onValueChange={setFilterKon}>
            <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              {KONDISI.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {(search || filterKat !== "all" || filterKon !== "all" || filterStok !== "all") && (
          <Button variant="ghost" size="icon" onClick={resetFilters} className="text-muted-foreground hover:text-foreground" title="Reset Filter">
            <FilterX className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* table */}
      <div className="surface-card rounded-xl overflow-hidden border border-border/50 shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-elevated border-b border-border">
              <tr className="text-left font-mono text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3 w-16 text-center">Foto</th>
                <th className="px-4 py-3">Kode / Nama</th>
                <th className="px-4 py-3">Detail Aset</th>
                <th className="px-4 py-3 text-right">Sisa Stok</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {filtered.length === 0 ? (
                  <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <td colSpan={6} className="py-20 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Info className="h-8 w-8 text-muted-foreground/30" />
                        <p>Tidak ada barang yang ditemukan.</p>
                        <Button variant="link" onClick={resetFilters}>Reset semua filter</Button>
                      </div>
                    </td>
                  </motion.tr>
                ) : (
                  paginatedItems.map((i: ItemRow) => {
                    const low = i.qty > 0 && i.qty <= 2;
                    const out = i.qty === 0;
                    const primaryImg = i.item_images?.find((img: Pick<ItemImage, "url" | "is_primary">) => img.is_primary) || i.item_images?.[0];
                    
                    return (
                      <motion.tr 
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={i.id} 
                        className="border-b border-border/30 hover:bg-surface-elevated/50 group"
                      >
                        <td className="px-4 py-3">
                          <div className="relative h-12 w-12 rounded-lg border bg-muted overflow-hidden flex items-center justify-center cursor-pointer group/img"
                               onClick={() => primaryImg && setZoomImg(primaryImg.url)}>
                            {primaryImg ? (
                              <>
                                <img src={primaryImg.url} alt={i.nama} className="h-full w-full object-cover transition-transform group-hover/img:scale-110" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                                  <ZoomIn className="h-4 w-4 text-white" />
                                </div>
                              </>
                            ) : (
                              <ImageIcon className="h-5 w-5 text-muted-foreground/30" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-primary text-[10px] font-bold tracking-tighter mb-0.5">{i.kode}</div>
                          <div className="font-semibold text-sm">{i.nama}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{i.categories?.nama_kategori || "Lain-lain"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground w-12">Merk:</span>
                              <span className="font-medium">{i.merk || "—"}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground w-12">Lokasi:</span>
                              <span className="font-medium text-[11px]">{i.lokasi_rak || "—"}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground w-12">Masuk:</span>
                              <span className="font-medium text-[11px]">{i.tanggal_masuk ? new Date(i.tanggal_masuk).toLocaleDateString("id-ID") : "—"}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className={`text-lg font-display font-bold ${out ? "text-destructive" : low ? "text-warning" : "text-success"}`}>
                            {i.qty}
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground">unit</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1.5 items-start">
                            <KondisiBadge value={i.kondisi} />
                            {out ? (
                              <Badge variant="destructive" className="text-[9px] h-5 px-1.5 font-bold animate-pulse">OUT OF STOCK</Badge>
                            ) : low ? (
                              <Badge variant="outline" className="text-[9px] h-5 px-1.5 font-bold border-warning text-warning">LOW STOCK</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] h-5 px-1.5 font-bold border-success text-success">AVAILABLE</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="outline" size="icon" onClick={() => setTransactionItem(i)} className="h-8 w-8 shadow-sm text-primary border-primary/30 hover:bg-primary/10" title="Transaksi Baru">
                              <ArrowLeftRight className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => { setEditing(i); setOpen(true); }} className="h-8 w-8 shadow-sm">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Hapus "${i.nama}"?`)) del.mutate(i.id); }} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface/30 p-4 rounded-xl border border-border/50">
          <p className="text-xs text-muted-foreground font-mono">
            Menampilkan <span className="text-foreground font-bold">{Math.min(filtered.length, (currentPage - 1) * itemsPerPage + 1)}</span> - <span className="text-foreground font-bold">{Math.min(filtered.length, currentPage * itemsPerPage)}</span> dari <span className="text-foreground font-bold">{filtered.length}</span> barang
          </p>
          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <PaginationItem key={page} className="hidden sm:block">
                  <PaginationLink 
                    isActive={currentPage === page}
                    onClick={() => setCurrentPage(page)}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}

              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Image Zoom Modal */}
      <Dialog open={!!zoomImg} onOpenChange={(v: boolean) => !v && setZoomImg(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black/95 border-none">
          {zoomImg && (
            <div className="relative aspect-video flex items-center justify-center p-4">
              <img src={zoomImg} alt="Preview" className="max-h-full max-w-full object-contain" />
              <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-white hover:bg-white/20" onClick={() => setZoomImg(null)}>
                <ZoomIn className="h-6 w-6 rotate-45" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Transaction Dialog */}
      <ItemTransactionDialog 
        item={transactionItem} 
        onClose={() => setTransactionItem(null)} 
        onDone={() => {
          qc.invalidateQueries({ queryKey: ["items", user?.id] });
          setTransactionItem(null);
        }} 
      />
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

function formatDateID(d: string) {
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

function ItemTransactionDialog({ item, onClose, onDone }: { item: ItemRow | null; onClose: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const [tipe, setTipe] = useState<"masuk" | "keluar">("keluar");
  const [tanggal, setTanggal] = useState(today());
  const [qty, setQty] = useState("1");
  const [dipasang, setDipasang] = useState("");
  const [keterangan, setKeterangan] = useState("");

  // Reset form when item changes
  useEffect(() => {
    if (item) {
      setTipe("keluar");
      setTanggal(today());
      setQty("1");
      setDipasang("");
      setKeterangan("");
    }
  }, [item]);

  const { data: recentTxs = [] } = useQuery({
    queryKey: ["item-transactions", item?.id],
    queryFn: async () => {
      if (!item) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("item_id", item.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!item,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user || !item) throw new Error("Pilih barang dulu");
      if (!tanggal) throw new Error("Tanggal wajib diisi");
      const q = parseInt(qty);
      if (q < 1) throw new Error("Qty harus > 0");
      if (tipe === "keluar" && q > item.qty) throw new Error(`Stok tidak cukup (tersedia: ${item.qty})`);

      const { data: newTx, error } = await supabase.from("transactions").insert({
        user_id: user.id,
        item_id: item.id,
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
        item_id: item.id,
        user_id: user.id,
        old_data: { prev_qty: item.qty },
        new_data: { ...newTx, current_qty: tipe === "masuk" ? item.qty + q : item.qty - q }
      });
    },
    onSuccess: () => {
      toast.success(`Transaksi ${tipe} berhasil dicatat untuk ${item?.nama}`);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = (e: FormEvent) => { e.preventDefault(); create.mutate(); };

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <div className="grid grid-cols-1 md:grid-cols-5 h-full">
          {/* Form Side */}
          <div className="md:col-span-3 p-6 border-r border-border/50">
            <DialogHeader className="mb-6">
              <DialogTitle className="font-display flex items-center gap-2 text-xl">
                <ArrowLeftRight className="h-5 w-5 text-primary" />
                Catat Transaksi
              </DialogTitle>
              <div className="mt-2 p-3 bg-surface-elevated rounded-lg border border-border/50">
                <div className="font-semibold text-sm">{item?.nama}</div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{item?.kode}</span>
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-bold border-primary/30 text-primary">STOK: {item?.qty}</Badge>
                </div>
              </div>
            </DialogHeader>

            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setTipe("masuk")}
                  className={`p-3 rounded-lg border text-sm font-semibold transition-all flex flex-col items-center gap-1 ${tipe === "masuk" ? "border-success bg-success/10 text-success shadow-[0_0_15px_rgba(16,185,129,0.1)]" : "border-border text-muted-foreground hover:border-border"}`}>
                  <ArrowDownToLine className="h-4 w-4" /> Masuk
                </button>
                <button type="button" onClick={() => setTipe("keluar")}
                  className={`p-3 rounded-lg border text-sm font-semibold transition-all flex flex-col items-center gap-1 ${tipe === "keluar" ? "border-warning bg-warning/10 text-warning shadow-[0_0_15px_rgba(245,158,11,0.1)]" : "border-border text-muted-foreground hover:border-border"}`}>
                  <ArrowUpFromLine className="h-4 w-4" /> Keluar
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-mono text-muted-foreground">Tanggal</Label>
                  <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required max={today()} className="bg-background/50" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-mono text-muted-foreground">Jumlah (Qty)</Label>
                  <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} required className="bg-background/50" />
                </div>
              </div>

              {tipe === "keluar" && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-mono text-muted-foreground">Dipasang Di / Lokasi</Label>
                  <Input value={dipasang} onChange={(e) => setDipasang(e.target.value)} placeholder="Mis. Kantor Lt 2, PC Pak Budi" className="bg-background/50" />
                </div>
              )}
              
              <div className="space-y-2">
                <Label className="text-xs uppercase font-mono text-muted-foreground">Keterangan</Label>
                <Textarea value={keterangan} onChange={(e) => setKeterangan(e.target.value)} rows={2} placeholder="Alasan, supplier, no. PO, dll..." className="bg-background/50 resize-none" />
              </div>

              <DialogFooter className="pt-4">
                <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
                <Button type="submit" disabled={create.isPending} className="bg-primary text-primary-foreground hover:bg-primary-glow min-w-[140px] font-bold">
                  {create.isPending ? "Menyimpan..." : `Simpan ${tipe === 'masuk' ? 'Masuk' : 'Keluar'}`}
                </Button>
              </DialogFooter>
            </form>
          </div>

          {/* History Side */}
          <div className="md:col-span-2 bg-surface-elevated/30 p-6 flex flex-col">
            <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
              <CalendarIcon className="h-3 w-3" /> Riwayat Terakhir
            </h3>
            <div className="flex-1 space-y-4 overflow-y-auto pr-2">
              {recentTxs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-30 py-10">
                  <Info className="h-8 w-8 mb-2" />
                  <p className="text-[10px] font-mono">Belum ada transaksi</p>
                </div>
              ) : (
                recentTxs.map((t: any) => (
                  <div key={t.id} className="relative pl-4 border-l-2 border-border/50 pb-1">
                    <div className={`absolute -left-[5px] top-0 h-2 w-2 rounded-full ${t.tipe === 'masuk' ? 'bg-success' : 'bg-warning'}`} />
                    <div className="text-[10px] font-mono text-muted-foreground">{formatDateID(t.tanggal || t.created_at.slice(0,10))}</div>
                    <div className="flex justify-between items-start mt-1">
                      <div className="text-xs font-bold">{t.tipe === 'masuk' ? 'BARANG MASUK' : 'BARANG KELUAR'}</div>
                      <div className={`text-xs font-mono font-bold ${t.tipe === 'masuk' ? 'text-success' : 'text-warning'}`}>
                        {t.tipe === 'masuk' ? '+' : '-'}{t.qty}
                      </div>
                    </div>
                    {(t.dipasang_di || t.keterangan) && (
                      <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2 bg-surface/50 p-1.5 rounded">
                        {t.dipasang_di && <span className="font-bold text-foreground/70">{t.dipasang_di}</span>}
                        {t.dipasang_di && t.keterangan && <br />}
                        {t.keterangan}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="mt-6 pt-4 border-t border-border/50">
              <Link to="/transactions" className="text-[10px] font-mono text-primary hover:underline flex items-center justify-center gap-1">
                LIHAT SEMUA TRANSAKSI <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function KondisiBadge({ value }: { value: Kondisi }) {
  const map: Record<Kondisi, string> = {
    baru: "bg-success/10 text-success border-success/30",
    bekas: "bg-accent/10 text-accent border-accent/30",
    rusak: "bg-destructive/10 text-destructive border-destructive/30",
    perbaikan: "bg-warning/10 text-warning border-warning/30",
  };
  const label = KONDISI.find((k) => k.value === value)?.label;
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono font-bold uppercase ${map[value]}`}>{label}</span>;
}

function ItemForm({ item, onClose, existingItems, dbCategories }: { item: ItemRow | null; onClose: () => void; existingItems: ItemRow[]; dbCategories: { id: string, nama_kategori: string }[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [kode, setKode] = useState(item?.kode ?? "");
  const [nama, setNama] = useState(item?.nama ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(item?.category_id ?? null);
  const [merk, setMerk] = useState(item?.merk ?? "");
  const [qty, setQty] = useState(item?.qty?.toString() ?? "0");
  const [lokasi, setLokasi] = useState(item?.lokasi_rak ?? "");
  const [kondisi, setKondisi] = useState<Kondisi>(item?.kondisi ?? "baru");
  const [tanggalMasuk, setTanggalMasuk] = useState(item?.tanggal_masuk ?? new Date().toISOString().split("T")[0]);
  const [catatan, setCatatan] = useState(item?.catatan ?? "");
  const [images, setImages] = useState<{ id?: string; url: string; is_primary: boolean; file?: File }[]>([]);

  useEffect(() => {
    if (item?.id) {
      supabase.from("item_images").select("*").eq("item_id", item.id)
        .then(({ data }) => {
          if (data) setImages(data.map((img: ItemImage) => ({ ...img, is_primary: !!img.is_primary })));
        });
    }
  }, [item?.id]);

  const generateKode = (katLabel: string) => {
    const prefix = katLabel.substring(0, 3).toUpperCase();
    const nums = existingItems
      .filter((i: ItemRow) => i.kode.startsWith(prefix))
      .map((i: ItemRow) => parseInt(i.kode.replace(prefix, "")) || 0);
    const next = (Math.max(0, ...nums) + 1).toString().padStart(3, "0");
    return `${prefix}${next}`;
  };

  const handleKategoriChange = (v: string) => {
    setCategoryId(v);
    const selected = dbCategories.find(c => c.id === v);
    if (selected && !item && !kode) setKode(generateKode(selected.nama_kategori));
  };

  const save = useMutation({
    mutationFn: async () => {
      try {
        if (!user) throw new Error("Not authenticated");
        const payload = {
          user_id: user.id,
          kode: kode.trim(),
          nama: nama.trim(),
          category_id: categoryId,
          merk: merk.trim() || null,
          qty: parseInt(qty) || 0,
          lokasi_rak: lokasi.trim() || null,
          kondisi,
          tanggal_masuk: tanggalMasuk,
          catatan: catatan.trim() || null,
        };

        let itemId = item?.id;
        
        if (item) {
          const { error } = await supabase.from("items").update(payload).eq("id", item.id);
          if (error) throw error;
          
          await supabase.from("audit_logs").insert({
            action: "updated",
            item_id: item.id,
            user_id: user.id,
            old_data: item as any,
            new_data: payload as any
          });
        } else {
          const { data, error } = await supabase.from("items").insert(payload).select().single();
          if (error) throw error;
          itemId = data.id;

          await supabase.from("audit_logs").insert({
            action: "created",
            item_id: itemId,
            user_id: user.id,
            old_data: null,
            new_data: payload as any
          });
        }

        // Handle Images
        if (itemId) {
          const currentImageIds = images.filter((img: { id?: string }) => img.id).map((img: { id?: string }) => img.id);
          const { data: existingImgs } = await supabase.from("item_images").select("*").eq("item_id", itemId);
          
          if (existingImgs) {
            const toDelete = existingImgs.filter((img: ItemImage) => !currentImageIds.includes(img.id));
            for (const img of toDelete) {
              const path = img.url.split("/").pop();
              if (path) await supabase.storage.from("item-images").remove([path]);
              await supabase.from("item_images").delete().eq("id", img.id);
            }
          }

          for (const img of images) {
            if (img.file) {
              const fileName = `${itemId}-${Date.now()}-${Math.random().toString(36).substring(7)}.webp`;
              const { error: uploadError } = await supabase.storage
                .from("item-images")
                .upload(fileName, img.file);
              
              if (uploadError) throw uploadError;

              const { data: publicUrl } = supabase.storage.from("item-images").getPublicUrl(fileName);
              
              await supabase.from("item_images").insert({
                item_id: itemId,
                url: publicUrl.publicUrl,
                is_primary: img.is_primary
              });
            } else if (img.id) {
              await supabase.from("item_images").update({ is_primary: img.is_primary }).eq("id", img.id);
            }
          }
        }
      } catch (e: any) {
        throw new Error("Gagal menyimpan barang: " + e.message);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success(item ? "Barang diupdate" : "Barang ditambahkan");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };

  return (
    <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">{item ? "Edit Barang" : "Tambah Barang Baru"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Kategori Database <span className="text-destructive">*</span></Label>
                <Select value={categoryId || ""} onValueChange={handleKategoriChange}>
                  <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                  <SelectContent>
                    {dbCategories.map((k) => <SelectItem key={k.id} value={k.id}>{k.nama_kategori}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kode Barang</Label>
                <Input value={kode} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKode(e.target.value.toUpperCase())} required className="font-mono" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Nama Barang</Label>
              <Input value={nama} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNama(e.target.value)} required placeholder="Mis. CCTV Outdoor 4MP" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Merk</Label>
                <Input value={merk} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMerk(e.target.value)} placeholder="Hikvision" />
              </div>
              <div className="space-y-2">
                <Label>Qty {item ? "Saat Ini" : "Awal"}</Label>
                <Input type="number" min={0} value={qty} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQty(e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Lokasi Rak</Label>
                <Input value={lokasi} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLokasi(e.target.value)} placeholder="Rak A1" />
              </div>
              <div className="space-y-2">
                <Label>Kondisi</Label>
                <Select value={kondisi} onValueChange={(v: string) => setKondisi(v as Kondisi)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {KONDISI.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tanggal Masuk</Label>
              <Input type="date" value={tanggalMasuk} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTanggalMasuk(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea value={catatan} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCatatan(e.target.value)} rows={3} placeholder="Tambahkan spesifikasi atau keterangan lainnya..." />
            </div>
          </div>

          <div className="space-y-4 border-l pl-6 hidden md:block">
            <ImageUpload 
              itemId={item?.id} 
              existingImages={images} 
              onImagesChange={setImages} 
            />
          </div>
          
          <div className="md:hidden space-y-4">
            <ImageUpload 
              itemId={item?.id} 
              existingImages={images} 
              onImagesChange={setImages} 
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={save.isPending} className="bg-primary text-primary-foreground hover:bg-primary-glow min-w-[120px]">
            {save.isPending ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Menyimpan...
              </span>
            ) : "Simpan Barang"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
