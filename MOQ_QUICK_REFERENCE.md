# MOQ Enforcement - Quick Reference Guide

## 🎯 What Was Implemented

Minimum Order Quantity (MOQ) enforcement for **Company → Distributor** ordering.

---

## 📍 Three Enforcement Points

### 1️⃣ **CATALOGUE** (`/distributor/catalogue`)

**When**: User clicks "Add to Cart"

**What Happens**:
```
IF product.moq > 1 THEN
  Show alert: "This product requires minimum order of [X] units"
  Buttons: [Cancel] [Add X Units]
ELSE
  Add 1 unit to cart
END IF
```

**Visual**: Purple MOQ badge on each product card
```
┌─────────────────────────┐
│  Paracetamol 500mg      │
│  SKU: PARA500           │
│  $2.50   [📦 MOQ: 100]  │ ← Badge shows when MOQ > 1
│         [+]             │
└─────────────────────────┘
```

---

### 2️⃣ **CART** (`/distributor/cart`)

**When**: Items in cart below MOQ

**What Happens**:
```
FOR EACH cart item DO
  IF item.quantity < item.moq THEN
    Display warning badge
  END IF
END FOR
```

**Visual**: Red warning appears under item
```
┌────────────────────────────────────┐
│ Paracetamol 500mg                  │
│ $2.50 / unit                       │
│ [⚠️ MOQ: 100 units required]       │ ← Red warning
│              [-] 50 [+]            │
└────────────────────────────────────┘
```

---

### 3️⃣ **CHECKOUT** (`/distributor/cart` → Place Order)

**When**: User clicks "Place Order"

**What Happens**:
```
items_below_moq = []

FOR EACH cart item DO
  IF item.quantity < item.moq THEN
    ADD to items_below_moq
  END IF
END FOR

IF items_below_moq.length > 0 THEN
  BLOCK checkout
  SHOW detailed error
  RETURN
END IF

PROCEED with order
```

**Visual**: Alert blocks checkout
```
┌─────────────────────────────────────────┐
│  ❌ Minimum Order Quantity Not Met      │
│                                         │
│  The following items do not meet the    │
│  minimum order quantity:                │
│                                         │
│  • Paracetamol: 50 units (MOQ: 100)    │
│  • Amoxicillin: 20 units (MOQ: 50)     │
│                                         │
│  Please update quantities to proceed.   │
│                                         │
│              [OK]                       │
└─────────────────────────────────────────┘
```

---

## 🔄 Complete User Flow

```
START
  │
  ├─→ [CATALOGUE]
  │   User browses products
  │   Sees MOQ badge on cards
  │   Clicks "Add to Cart"
  │   ↓
  │   IF MOQ > 1
  │   ├─→ Shows confirmation
  │   │   "Add [X] units?"
  │   │   ↓
  │   │   [Confirm] → Add MOQ quantity
  │   │   [Cancel] → Nothing added
  │   ELSE
  │   └─→ Add 1 unit
  │
  ├─→ [CART]
  │   User reviews items
  │   ↓
  │   Items below MOQ show ⚠️ warning
  │   User can adjust quantities
  │   ↓
  │   Clicks "Place Order"
  │
  └─→ [CHECKOUT]
      System validates ALL items
      ↓
      IF any item below MOQ
      ├─→ BLOCK checkout
      │   Show error with details
      │   User must fix
      ELSE
      └─→ ✅ Process order
          Clear cart
          Success!
```

---

## 📊 MOQ Validation Rules

| Scenario | Example | Result |
|----------|---------|--------|
| Adding new item (MOQ=1) | Click add | ✅ Add 1 unit |
| Adding new item (MOQ=100) | Click add | ⚠️ Confirm: Add 100? |
| Cart item below MOQ | 50 units (MOQ: 100) | ⚠️ Show warning |
| Cart item meets MOQ | 100 units (MOQ: 100) | ✅ No warning |
| Checkout with item below MOQ | Any item < MOQ | ❌ Block order |
| Checkout all items meet MOQ | All items ≥ MOQ | ✅ Allow order |

---

## 🎨 Visual Indicators

### Purple Badge (Informational)
- Location: Catalogue product cards
- Color: `#7C3AED` (Purple)
- Icon: 📦 Package
- Shows: "MOQ: [number]"

### Red Warning (Alert)
- Location: Cart items
- Color: `#DC2626` (Red)
- Icon: ⚠️ Alert circle
- Shows: "MOQ: [number] units required"

### Checkout Error (Blocking)
- Type: Alert dialog
- Color: Red header
- Icon: ❌ Error
- Shows: List of all non-compliant items

---

## 💻 Code Locations

### Catalogue (`app/distributor/catalogue.tsx`)
```javascript
// Line 59: addToCart() - MOQ validation
// Line 181: Product card - MOQ badge display
// Line 284: Styles - MOQ badge styling
```

### Cart (`app/distributor/cart.tsx`)
```javascript
// Line 27: Interface - Added moq field
// Line 56: fetchCart() - Include moq in query
// Line 115: placeOrder() - MOQ checkout validation
// Line 239: Render - MOQ warning display
// Line 330: Styles - Warning badge styling
```

---

## 🧪 Test Cases

### ✅ Test 1: Catalogue MOQ Display
1. Open catalogue
2. Find product with MOQ > 1
3. **Expected**: Purple badge shows "MOQ: X"

### ✅ Test 2: Add to Cart (MOQ > 1)
1. Click add on product with MOQ 100
2. **Expected**: Alert asks "Add 100 units?"
3. Confirm
4. **Expected**: 100 units in cart

### ✅ Test 3: Cart Warning Display
1. Have item with 50 units (MOQ: 100)
2. View cart
3. **Expected**: Red warning "MOQ: 100 units required"

### ✅ Test 4: Checkout Block
1. Cart has item below MOQ
2. Click "Place Order"
3. **Expected**: Alert blocks checkout with details

### ✅ Test 5: Successful Checkout
1. All items meet MOQ
2. Click "Place Order"
3. **Expected**: Order processes successfully

---

## 🚀 Quick Fixes for Common Issues

### Issue: MOQ badge not showing
**Check**: Product has `moq` value in database
**Fix**: Set MOQ in admin product management

### Issue: Warning always shows
**Check**: Quantity vs MOQ comparison
**Fix**: Increase quantity to MOQ or above

### Issue: Can't checkout
**Check**: All items meet MOQ requirements
**Fix**: Adjust quantities or remove non-compliant items

### Issue: Confirmation not appearing
**Check**: Product MOQ is > 1
**Fix**: Set MOQ appropriately in products table

---

## 📝 Business Rules

1. **Default MOQ**: 1 unit (if not specified)
2. **Enforcement**: Company → Distributor only
3. **Increments**: User can adjust by any amount (no step enforcement)
4. **Existing Cart**: Increments work normally (+1)
5. **New Items**: Must confirm MOQ quantity
6. **Checkout**: Hard block, no exceptions

---

## 🎯 Success Criteria

✅ MOQ visible on catalogue  
✅ Add to cart validates MOQ  
✅ Cart shows warnings for items below MOQ  
✅ Checkout blocks invalid orders  
✅ Clear error messages guide users  
✅ No breaking changes to existing flows  

---

## 📞 Support Information

**Files Modified**: 2
- `app/distributor/catalogue.tsx`
- `app/distributor/cart.tsx`

**Database Changes**: None (uses existing `products.moq` field)

**Rollback**: Revert both files to previous commit

---

**Implementation Date**: 2026-01-18  
**Version**: 1.0  
**Status**: ✅ Complete
