-- Categories enum
CREATE TYPE public.item_category AS ENUM ('cctv', 'peripheral', 'storage', 'networking', 'printer', 'sparepart', 'tools', 'other');
CREATE TYPE public.item_condition AS ENUM ('baru', 'bekas', 'rusak', 'perbaikan');
CREATE TYPE public.transaction_type AS ENUM ('masuk', 'keluar');

-- Items table
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kode TEXT NOT NULL,
  nama TEXT NOT NULL,
  kategori public.item_category NOT NULL DEFAULT 'other',
  merk TEXT,
  qty INTEGER NOT NULL DEFAULT 0,
  lokasi_rak TEXT,
  kondisi public.item_condition NOT NULL DEFAULT 'baru',
  catatan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, kode)
);

-- Transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  tipe public.transaction_type NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  keterangan TEXT,
  dipasang_di TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- RLS items
CREATE POLICY "users_select_own_items" ON public.items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_items" ON public.items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_items" ON public.items FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own_items" ON public.items FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS transactions
CREATE POLICY "users_select_own_tx" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_tx" ON public.transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_tx" ON public.transactions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own_tx" ON public.transactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Auto update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER items_updated_at BEFORE UPDATE ON public.items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Trigger to auto-adjust qty on transaction insert
CREATE OR REPLACE FUNCTION public.apply_transaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tipe = 'masuk' THEN
    UPDATE public.items SET qty = qty + NEW.qty WHERE id = NEW.item_id AND user_id = NEW.user_id;
  ELSE
    UPDATE public.items SET qty = qty - NEW.qty WHERE id = NEW.item_id AND user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER tx_apply AFTER INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.apply_transaction();

CREATE INDEX idx_items_user ON public.items(user_id);
CREATE INDEX idx_tx_user ON public.transactions(user_id);
CREATE INDEX idx_tx_item ON public.transactions(item_id);