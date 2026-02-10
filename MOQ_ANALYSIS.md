# MOQ (Minimum Order Quantity) Analysis for Pharmaceutical Supply Chain

## Executive Summary

After analyzing the complete project structure, **MOQ should be implemented from Company/Admin to Distributor**, NOT from Distributor to Pharmacy.

---

## Project Architecture

The system follows a **3-tier pharmaceutical supply chain**:

```
COMPANY/ADMIN (Master Catalog)
        ↓
DISTRIBUTORS (Wholesale)
        ↓
  PHARMACIES (Retail)
```

---

## Current Implementation Analysis

### 1. **Products Table (Master Catalog)**
- Location: Managed by Admin
- Schema includes: `moq`, `distributor_price`, `price` (retail)
- The `moq` field currently exists at the product level

### 2. **Flow Analysis**

#### **Admin → Distributor Flow**
- **Table**: `distributor_admin_orders`
- **Purpose**: Distributors order from Admin/Company
- **Price**: Uses `distributor_price` (wholesale price)
- **Current Process**:
  1. Distributor browses master catalogue (`/distributor/catalogue.tsx`)
  2. Adds products to cart (`distributor_cart_items`)
  3. Places order to Admin (`distributor_admin_orders`)
  
#### **Distributor → Pharmacy Flow**
- **Table**: `orders`
- **Purpose**: Pharmacies order from Distributors
- **Price**: Uses retail `price`
- **Current Process**:
  1. Pharmacy adds inventory from global catalog
  2. Pharmacy places orders to their assigned distributor
  3. Distributor fulfills pharmacy orders

### 3. **Stock Management**

#### **Distributor Stock** (`distributor_stock` table)
- Fields: `distributor_id`, `product_id`, `quantity`, `min_order_quantity`
- Distributors maintain their own inventory
- They set MOQ for pharmacies on their stock items

#### **Pharmacy Inventory** (`pharmacy_inventory` table)
- Pharmacies maintain local inventory
- They order from distributors based on distributor's MOQ

---

## Why MOQ Should Be Company → Distributor

### **1. Business Logic Rationale**

#### **Manufacturer/Company Perspective:**
- Companies manufacture products in bulk batches
- They have economies of scale requiring minimum wholesale orders
- Distributors are wholesale buyers who should meet manufacturer MOQs
- This is standard practice in pharmaceutical supply chains

#### **Distributor Perspective:**
- Distributors already have flexibility via `min_order_quantity` in `distributor_stock`
- They can set their own MOQs for pharmacies independently
- They need to meet company MOQs when restocking
- They act as bulk buyers and retail sellers

#### **Pharmacy Perspective:**
- Pharmacies are retail entities ordering smaller quantities
- They should face distributor-set MOQs (which are typically lower)
- They need flexibility to order based on local demand
- Rigid MOQs from company would hurt small pharmacies

### **2. Current Code Evidence**

```typescript
// File: app/admin/management/products.tsx
interface Product {
  moq: number;              // ← This is at product level (Company sets)
  distributor_price: number; // ← Wholesale price
  price: number;             // ← Retail price
}
```

```typescript
// File: app/distributor/stock.tsx (Line 78, 142)
// Distributors set their own min_order_quantity when managing stock
{
  min_order_quantity: moq,  // ← Distributor sets this for pharmacies
}
```

### **3. Technical Implementation**

The MOQ at the product level (set by admin) is currently:
- ✅ Available in `app/distributor/catalogue.tsx` (distributors see it when ordering)
- ✅ Stored in products table
- ❌ **NOT enforced** in distributor cart/ordering process

The `min_order_quantity` in `distributor_stock`:
- ✅ Set by distributors for their stock
- ✅ Visible to pharmacies (if they order from distributor stock)
- ❌ Validation exists but not fully enforced in pharmacy ordering

---

## Recommended Implementation

### **Phase 1: Enforce Company MOQ for Distributors**

**Location**: `app/distributor/cart.tsx` and `app/distributor/catalogue.tsx`

1. **When adding to cart**: Validate against product's MOQ
   ```typescript
   const addToCart = async (product: Product) => {
     const moq = product.moq || 1;
     // Check if adding quantity meets MOQ
     if (quantity < moq) {
       Alert.alert('MOQ Not Met', 
         `Minimum order quantity for ${product.name} is ${moq} units`);
       return;
     }
     // ... rest of add to cart logic
   }
   ```

2. **In cart view**: Show MOQ warning for items below minimum
   ```typescript
   {item.quantity < item.products.moq && (
     <Text style={styles.moqWarning}>
       ⚠️ MOQ: {item.products.moq} units required
     </Text>
   )}
   ```

3. **At checkout**: Prevent order placement if any item is below MOQ
   ```typescript
   const placeOrder = async () => {
     const belowMoq = cartItems.filter(
       item => item.quantity < (item.products.moq || 1)
     );
     
     if (belowMoq.length > 0) {
       Alert.alert('Cannot Place Order', 
         'Some items do not meet minimum order quantity');
       return;
     }
     // ... proceed with order
   }
   ```

### **Phase 2: Maintain Distributor Flexibility**

**Location**: `app/distributor/stock.tsx`

Keep the existing `min_order_quantity` system where distributors set their own MOQs for pharmacies. This is separate from company MOQ.

**Example**:
- Company MOQ for Drug X: 1000 units (wholesale)
- Distributor buys 1000 units from company
- Distributor sets MOQ for pharmacies: 50 units (retail)
- Pharmacies order minimum 50 units from distributor

---

## Database Schema Validation

### Current Schema (Correct):
```sql
-- products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS moq integer DEFAULT 1;
-- ✅ This represents Company → Distributor MOQ

-- distributor_stock table  
CREATE TABLE distributor_stock (
  min_order_quantity integer,  
  -- ✅ This represents Distributor → Pharmacy MOQ
);
```

### No Changes Needed to Schema
The database structure is already correct. We only need to:
1. **Enforce** the product-level MOQ in distributor ordering
2. **Enforce** the distributor stock MOQ in pharmacy ordering

---

## Business Impact Summary

| Stakeholder | Impact | Benefit |
|------------|--------|---------|
| **Company/Admin** | Sets MOQ on products | Ensures minimum profitable batch orders |
| **Distributors** | Must meet company MOQ when restocking | Can buy in bulk, set their own retail MOQs |
| **Pharmacies** | Face distributor MOQs (typically lower) | More flexibility, can order based on demand |

---

## Implementation Priority

**HIGH PRIORITY**: 
- ✅ Enforce Company MOQ in `distributor/cart.tsx`
- ✅ Add MOQ validation in `distributor/catalogue.tsx`

**MEDIUM PRIORITY**:
- ⚠️ Enhance MOQ display in distributor UI
- ⚠️ Add bulk quantity helpers (e.g., "Add MOQ" button)

**LOW PRIORITY**:
- 💡 Analytics: Track MOQ compliance
- 💡 Warnings: Notify distributors approaching reorder levels vs MOQ

---

## Conclusion

**MOQ should be enforced from Company to Distributor** because:

1. ✅ **Aligns with real-world pharmaceutical distribution**
2. ✅ **Already implemented in database schema** (products.moq)
3. ✅ **Maintains distributor flexibility** (via distributor_stock.min_order_quantity)
4. ✅ **Protects company margins** on wholesale orders
5. ✅ **Allows pharmacies retail-level ordering** flexibility

The current codebase structure supports this model - it just needs **validation enforcement** in the distributor ordering flow.
