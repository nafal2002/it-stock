-- Add tanggal_masuk to items table
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS tanggal_masuk DATE DEFAULT CURRENT_DATE;

-- Drop old kategori column if it exists
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='kategori') THEN
        ALTER TABLE public.items DROP COLUMN kategori;
    END IF;
END $$;
