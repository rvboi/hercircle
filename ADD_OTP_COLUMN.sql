-- Add delivery_otp column to orders table for Pharmacy -> Distributor/Admin delivery verification
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_otp TEXT;

-- Add delivery_otp column to distributor_admin_orders table for Distributor -> Admin delivery verification
ALTER TABLE distributor_admin_orders ADD COLUMN IF NOT EXISTS delivery_otp TEXT;
