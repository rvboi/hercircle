# 🔍 MOQ Not Visible - Troubleshooting Guide

## Issue: MOQ Not Showing in Master Catalogue

---

## ✅ **Fix Applied**

Changed the MOQ badge display condition from:
```typescript
{item.moq && item.moq > 1 && ( ... )}  // Only showed if MOQ > 1
```

To:
```typescript
{item.moq !== undefined && item.moq !== null && ( ... )}  // Shows for all MOQ values
```

**Result**: MOQ badge will now display even if MOQ is 1.

---

## 🔍 **How to Check if Products Have MOQ**

### Method 1: Check Console Logs (Easiest)

1. Open the app in Expo
2. Navigate to **Distributor → Catalogue**
3. Open the **developer console** (terminal running `bun expo start`)
4. Look for these log messages:
   ```
   Sample product: { id: '...', name: '...', moq: 100, ... }
   Products with MOQ: 5 / 10
   ```

**What this means**:
- If you see `moq: 100` → MOQ is set ✅
- If you see `moq: null` or no `moq` field → MOQ is NOT set ❌
- "Products with MOQ: 0 / 10" → None of your products have MOQ set

---

### Method 2: Check Database Directly

Run this SQL query in **Supabase SQL Editor**:

```sql
-- Check which products have MOQ set
SELECT 
  id,
  name,
  sku,
  moq,
  distributor_price,
  price
FROM products
ORDER BY name
LIMIT 20;
```

**Look for**:
- `moq` column with NULL values → MOQ not set
- `moq` column with numbers → MOQ is set ✅

---

## 🛠️ **How to Set MOQ Values**

### Option 1: Through Admin UI (Recommended)

1. Login as **Admin**
2. Go to **Admin Dashboard**
3. Navigate to **Manage Products**
4. Click on a product to edit
5. Find the **"MOQ"** field
6. Enter the minimum order quantity (e.g., 100)
7. Click **"Save"**

**Repeat for all products**

---

### Option 2: Bulk Update via SQL (Faster)

If you want to set MOQ for all products at once:

```sql
-- Set default MOQ of 50 for all products
UPDATE products
SET moq = 50
WHERE moq IS NULL;

-- Or set different MOQ based on price tiers
UPDATE products
SET moq = CASE
  WHEN distributor_price < 10 THEN 100   -- Cheap items: MOQ 100
  WHEN distributor_price < 50 THEN 50    -- Mid-range: MOQ 50
  ELSE 25                                 -- Expensive: MOQ 25
END
WHERE moq IS NULL;
```

---

### Option 3: Set Specific MOQs

```sql
-- Update specific products by name
UPDATE products SET moq = 100 WHERE name LIKE '%Paracetamol%';
UPDATE products SET moq = 50 WHERE name LIKE '%Amoxicillin%';

-- Update by SKU
UPDATE products SET moq = 100 WHERE sku = 'PARA500';
UPDATE products SET moq = 75 WHERE sku = 'AMOX250';

-- Update by ID
UPDATE products SET moq = 100 WHERE id = 'your-product-id-here';
```

---

## 🧪 **Testing After Setting MOQ**

1. **Refresh the catalogue**:
   - Pull down to refresh in the app
   - Or restart the app

2. **Check for MOQ badge**:
   - Look for purple badge: `📦 MOQ: 100`
   - Badge should appear next to price

3. **Test add to cart**:
   - Click add to cart on a product with MOQ
   - Should see confirmation: "Add [X] units?"

4. **Verify in console**:
   - Check logs: "Products with MOQ: 10 / 10" (all have MOQ)

---

## 📊 **Recommended MOQ Values**

Based on pharmaceutical industry standards:

| Product Type | Suggested MOQ | Reason |
|--------------|---------------|---------|
| Generic tablets (low cost) | 100-500 | High volume, low margin |
| Branded medicines | 50-100 | Medium volume |
| Specialty drugs | 25-50 | Lower volume, higher value |
| OTC products | 100-200 | High turnover |
| Medical supplies | 50-100 | Standard wholesale |

---

## 🔧 **Current Code Changes**

### File: `app/distributor/catalogue.tsx`

**Change 1**: Updated display condition (Line 183)
```typescript
// Before
{item.moq && item.moq > 1 && (

// After
{item.moq !== undefined && item.moq !== null && (
```

**Change 2**: Added debug logging (Line 51-54)
```typescript
if (data && data.length > 0) {
  console.log('Sample product:', data[0]);
  console.log('Products with MOQ:', data.filter(p => p.moq).length, '/', data.length);
}
```

---

## 🎯 **Quick Checklist**

- [ ] Check console logs for MOQ data
- [ ] Verify database has MOQ column
- [ ] Set MOQ values for products (via Admin UI or SQL)
- [ ] Refresh catalogue in app
- [ ] Verify MOQ badge appears
- [ ] Test add to cart functionality

---

## 🆘 **Still Not Showing?**

### Check 1: Database Schema
```sql
-- Verify moq column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products' 
AND column_name = 'moq';
```

**Expected result**: 
```
column_name | data_type
moq         | integer
```

If this returns nothing, run:
```sql
-- Add MOQ column if missing
ALTER TABLE products ADD COLUMN moq INTEGER DEFAULT 1;
```

---

### Check 2: Product Data Type
In `app/distributor/catalogue.tsx`, verify the interface (Line 19):
```typescript
interface Product {
    id: string;
    name: string;
    description?: string;
    distributor_price?: number;
    price?: number;
    sku?: string;
    image_url?: string;
    moq?: number;  // ← Should be here
}
```

---

### Check 3: Supabase RLS Policies

Make sure Row Level Security allows reading MOQ:
```sql
-- Check if policies block MOQ reading
SELECT * FROM products LIMIT 1;
```

If MOQ is still NULL, check RLS policies:
```sql
-- View current policies
SELECT * FROM pg_policies WHERE tablename = 'products';
```

---

## 📱 **Visual Test**

After setting MOQ, you should see:

```
┌─────────────────────────────────┐
│ 📷 Product Image                │
├─────────────────────────────────┤
│ Paracetamol 500mg               │
│ SKU: PARA500                    │
│                                 │
│ $2.50        [📦 MOQ: 100]     │  ← Should see this!
│                   [+]           │
└─────────────────────────────────┘
```

If you see the price but NO badge:
- MOQ is probably NULL/not set in database

If you see nothing at all:
- Check console for errors
- Verify products are loading

---

## 🚀 **Next Steps**

1. **Check Console Logs**: Run the app and look at terminal output
2. **Verify Database**: Query products table for MOQ values
3. **Set MOQ**: Use Admin UI or SQL to set MOQ for products
4. **Test**: Refresh catalogue and verify badges appear

---

## 💡 **Pro Tip**

Create a script to set default MOQs based on product categories:

```sql
-- Set MOQ based on product naming patterns
UPDATE products SET moq = 100 WHERE name ILIKE '%tablet%' OR name ILIKE '%capsule%';
UPDATE products SET moq = 50 WHERE name ILIKE '%syrup%' OR name ILIKE '%suspension%';
UPDATE products SET moq = 25 WHERE name ILIKE '%injection%' OR name ILIKE '%ampoule%';

-- Verify
SELECT name, moq FROM products ORDER BY moq DESC;
```

---

**Need more help?** Check the console logs first - they'll tell you exactly what's happening! 🔍
