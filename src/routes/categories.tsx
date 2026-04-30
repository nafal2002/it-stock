import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, Tag, Info, FilterX } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/categories")({
  component: () => (
    <AppLayout>
      <CategoriesPage />
    </AppLayout>
  ),
});

type Category = Tables<"categories">;

function CategoriesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Real-time subscription
  useEffect(() => {
    if (!user) return;
    const channel = (supabase.channel("categories-changes") as any)
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () => {
        qc.invalidateQueries({ queryKey: ["categories", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories" as any)
        .select("*")
        .is("deleted_at", null)
        .order("nama_kategori");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      // Soft delete
      const { error } = await supabase
        .from("categories" as any)
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      
      // Log to audit
      await supabase.from("audit_logs").insert({
        action: "category_deleted",
        user_id: user?.id,
        old_data: (categories.find((c: any) => c.id === id) as any)
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Kategori berhasil dihapus (soft delete)");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    return categories.filter((c) => 
      !search || c.nama_kategori.toLowerCase().includes(search.toLowerCase()) || 
      (c.deskripsi && c.deskripsi.toLowerCase().includes(search.toLowerCase()))
    );
  }, [categories, search]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [search]);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-mono text-primary mb-1">// MANAGEMENT</p>
          <h1 className="text-3xl font-display font-bold">Kategori Barang</h1>
          <p className="text-muted-foreground text-sm mt-1">Kelola kategori untuk pengelompokan aset yang lebih rapi.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if(!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary-glow font-semibold">
              <Plus className="h-4 w-4 mr-2" /> Tambah Kategori
            </Button>
          </DialogTrigger>
          <CategoryForm 
            category={editing} 
            onClose={() => { setOpen(false); setEditing(null); }} 
          />
        </Dialog>
      </div>

      <div className="flex items-center gap-4 bg-surface/50 p-4 rounded-xl border border-border/50 shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Cari kategori..." 
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {search && (
          <Button variant="ghost" size="icon" onClick={() => setSearch("")}>
            <FilterX className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="surface-card rounded-xl overflow-hidden border border-border/50 shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-surface-elevated border-b border-border">
              <tr className="font-mono text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3">Nama Kategori</th>
                <th className="px-4 py-3">Deskripsi</th>
                <th className="px-4 py-3">Dibuat</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {isLoading ? (
                  <tr><td colSpan={4} className="py-12 text-center text-muted-foreground">Memuat data...</td></tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-20 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Info className="h-8 w-8 text-muted-foreground/30" />
                        <p>Tidak ada kategori ditemukan.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginated.map((c) => (
                    <motion.tr 
                      layout key={c.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="border-b border-border/30 hover:bg-surface-elevated/50 group transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-primary" />
                          <span className="font-semibold">{c.nama_kategori}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                        {c.deskripsi || "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {new Date(c.created_at).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { setEditing(c); setOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => { if(confirm(`Hapus kategori "${c.nama_kategori}"?`)) del.mutate(c.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center mt-4">
          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <PaginationItem key={p}>
                  <PaginationLink isActive={currentPage === p} onClick={() => setCurrentPage(p)} className="cursor-pointer">{p}</PaginationLink>
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
    </div>
  );
}

function CategoryForm({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [nama, setNama] = useState(category?.nama_kategori ?? "");
  const [deskripsi, setDeskripsi] = useState(category?.deskripsi ?? "");

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Auth required");
      const payload = {
        user_id: user.id,
        nama_kategori: nama.trim(),
        deskripsi: deskripsi.trim() || null,
        updated_at: new Date().toISOString()
      };

      if (category) {
        const { error } = await supabase.from("categories" as any).update(payload).eq("id", category.id);
        if (error) throw error;
        await supabase.from("audit_logs").insert({ action: "category_updated", user_id: user.id, item_id: null, old_data: category as any, new_data: payload as any });
      } else {
        const { data, error } = await supabase.from("categories" as any).insert(payload).select().single();
        if (error) throw error;
        await supabase.from("audit_logs").insert({ action: "category_created", user_id: user.id, item_id: null, new_data: data as any });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success(category ? "Kategori diperbarui" : "Kategori ditambahkan");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">{category ? "Edit Kategori" : "Tambah Kategori"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4 py-4">
        <div className="space-y-2">
          <Label>Nama Kategori <span className="text-destructive">*</span></Label>
          <Input value={nama} onChange={(e) => setNama(e.target.value)} required placeholder="Mis. Perangkat Jaringan" />
        </div>
        <div className="space-y-2">
          <Label>Deskripsi</Label>
          <Textarea value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} rows={3} placeholder="Keterangan opsional tentang kategori ini..." />
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={save.isPending} className="bg-primary text-primary-foreground hover:bg-primary-glow">
            {save.isPending ? "Menyimpan..." : "Simpan Kategori"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
