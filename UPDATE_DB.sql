-- Run this in your Supabase SQL Editor to update the products table schema

-- 1. Add image_url column if it doesn't exist
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url text;

-- 2. Add distributor_price column if it doesn't exist (default to 0)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS distributor_price numeric(10, 2) DEFAULT 0;

-- 3. Add sku column if it doesn't exist
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku text;

-- 4. Add moq column if it doesn't exist
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS moq integer DEFAULT 1;

-- 5. Add unique constraint to sku if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_sku_key') THEN
        ALTER TABLE public.products ADD CONSTRAINT products_sku_key UNIQUE (sku);
    END IF;
END $$;

-- 6. (Optional) Update existing rows to have a default distributor_price if it's 0
-- UPDATE public.products SET distributor_price = price WHERE distributor_price = 0 AND price IS NOT NULL;
