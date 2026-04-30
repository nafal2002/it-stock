-- 1. Create categories table with soft delete support
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nama_kategori TEXT NOT NULL,
    deskripsi TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE -- For soft delete
);

-- 2. Add category_id to items table
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- 3. Enable RLS on categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for categories
CREATE POLICY "Users can view their own categories" ON public.categories
    FOR SELECT TO authenticated USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert their own categories" ON public.categories
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories" ON public.categories
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 5. Trigger for updated_at
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 6. Indexing for performance
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_nama ON public.categories(nama_kategori);
CREATE INDEX IF NOT EXISTS idx_items_category_id ON public.items(category_id);
