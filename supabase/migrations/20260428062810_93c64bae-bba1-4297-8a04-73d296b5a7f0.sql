ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS tanggal DATE NOT NULL DEFAULT CURRENT_DATE;
CREATE INDEX IF NOT EXISTS idx_transactions_tanggal ON public.transactions(tanggal DESC);