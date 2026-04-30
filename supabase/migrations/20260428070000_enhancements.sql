-- Create item_images table
CREATE TABLE IF NOT EXISTS public.item_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_item_images_item_id ON public.item_images(item_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_item_id ON public.audit_logs(item_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_kategori ON public.items(kategori);
CREATE INDEX IF NOT EXISTS idx_items_kondisi ON public.items(kondisi);
CREATE INDEX IF NOT EXISTS idx_transactions_item_id ON public.transactions(item_id);

-- Enable RLS
ALTER TABLE public.item_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for item_images
CREATE POLICY "Users can view item images" ON public.item_images
    FOR SELECT USING (true);

CREATE POLICY "Users can insert item images" ON public.item_images
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own item images" ON public.item_images
    FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own item images" ON public.item_images
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- Create policies for audit_logs
CREATE POLICY "Users can view audit logs" ON public.audit_logs
    FOR SELECT USING (true);

CREATE POLICY "System can insert audit logs" ON public.audit_logs
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Create storage bucket for item images
-- Note: Some environments might require this to be done via the Supabase Dashboard
INSERT INTO storage.buckets (id, name, public) 
VALUES ('item-images', 'item-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'item-images');
CREATE POLICY "Auth Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'item-images' AND auth.role() = 'authenticated');
CREATE POLICY "Auth Delete" ON storage.objects FOR DELETE USING (bucket_id = 'item-images' AND auth.role() = 'authenticated');
CREATE POLICY "Auth Update" ON storage.objects FOR UPDATE USING (bucket_id = 'item-images' AND auth.role() = 'authenticated');
