-- ===================================================================
-- MOQ SETUP SCRIPT
-- Run this in Supabase SQL Editor to set MOQ for products
-- ===================================================================

-- Step 1: Check current state
-- ===================================================================
SELECT 
  'Total Products' as metric,
  COUNT(*) as count
FROM products

UNION ALL

SELECT 
  'Products with MOQ set' as metric,
  COUNT(*) as count
FROM products
WHERE moq IS NOT NULL

UNION ALL

SELECT 
  'Products without MOQ' as metric,
  COUNT(*) as count
FROM products
WHERE moq IS NULL;


-- Step 2: View products without MOQ
-- ===================================================================
SELECT 
  id,
  name,
  sku,
  distributor_price,
  moq
FROM products
WHERE moq IS NULL
ORDER BY name
LIMIT 20;


-- Step 3: SET DEFAULT MOQ FOR ALL PRODUCTS
-- ===================================================================
-- Option A: Set same MOQ for all products (e.g., 50 units)
-- Uncomment to run:

-- UPDATE products
-- SET moq = 50
-- WHERE moq IS NULL;


-- Option B: Set MOQ based on price tiers
-- Uncomment to run:

-- UPDATE products
-- SET moq = CASE
--   WHEN distributor_price < 5 THEN 200      -- Very cheap: MOQ 200
--   WHEN distributor_price < 10 THEN 100     -- Cheap: MOQ 100
--   WHEN distributor_price < 25 THEN 50      -- Mid-range: MOQ 50
--   WHEN distributor_price < 100 THEN 25     -- Higher value: MOQ 25
--   ELSE 10                                   -- Very expensive: MOQ 10
-- END
-- WHERE moq IS NULL;


-- Option C: Set MOQ based on product categories/names
-- Uncomment and customize to run:

-- UPDATE products SET moq = 100 WHERE name ILIKE '%tablet%' AND moq IS NULL;
-- UPDATE products SET moq = 100 WHERE name ILIKE '%capsule%' AND moq IS NULL;
-- UPDATE products SET moq = 50 WHERE name ILIKE '%syrup%' AND moq IS NULL;
-- UPDATE products SET moq = 50 WHERE name ILIKE '%suspension%' AND moq IS NULL;
-- UPDATE products SET moq = 25 WHERE name ILIKE '%injection%' AND moq IS NULL;
-- UPDATE products SET moq = 25 WHERE name ILIKE '%ampoule%' AND moq IS NULL;


-- Step 4: VERIFY THE CHANGES
-- ===================================================================
SELECT 
  name,
  sku,
  distributor_price,
  price,
  moq
FROM products
ORDER BY moq DESC, name
LIMIT 50;


-- Step 5: Check statistics after update
-- ===================================================================
SELECT 
  moq,
  COUNT(*) as product_count,
  AVG(distributor_price::numeric) as avg_price
FROM products
WHERE moq IS NOT NULL
GROUP BY moq
ORDER BY moq DESC;


-- ===================================================================
-- SPECIFIC PRODUCT UPDATES (Examples)
-- ===================================================================

-- Update specific products by name
-- UPDATE products SET moq = 100 WHERE name = 'Paracetamol 500mg';
-- UPDATE products SET moq = 50 WHERE name = 'Amoxicillin 250mg';

-- Update by SKU
-- UPDATE products SET moq = 100 WHERE sku = 'PARA500';
-- UPDATE products SET moq = 75 WHERE sku = 'AMOX250';


-- ===================================================================
-- RECOMMENDED: Set intelligent defaults based on value
-- ===================================================================

-- High-value products (expensive): Lower MOQ
-- UPDATE products 
-- SET moq = 10 
-- WHERE distributor_price >= 100 AND moq IS NULL;

-- Medium-value products: Medium MOQ
-- UPDATE products 
-- SET moq = 50 
-- WHERE distributor_price BETWEEN 10 AND 100 AND moq IS NULL;

-- Low-value products (cheap): Higher MOQ
-- UPDATE products 
-- SET moq = 100 
-- WHERE distributor_price < 10 AND moq IS NULL;


-- ===================================================================
-- FINAL CHECK: Ensure all products have MOQ
-- ===================================================================
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ All products have MOQ set!'
    ELSE '❌ Some products still missing MOQ'
  END as status,
  COUNT(*) as products_without_moq
FROM products
WHERE moq IS NULL;


-- ===================================================================
-- USAGE INSTRUCTIONS:
-- ===================================================================
-- 1. Run "Step 1" to see current state
-- 2. Run "Step 2" to see which products need MOQ
-- 3. Choose ONE option from "Step 3" and uncomment it
-- 4. Run "Step 4" to verify changes
-- 5. Run "Step 5" to see statistics
-- 6. Run "Final Check" to confirm all products have MOQ
-- ===================================================================
