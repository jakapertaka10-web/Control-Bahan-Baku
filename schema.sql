-- Legacy SQLite schema retained only to document the source wms.db format.
-- Runtime data access and schema changes use Supabase PostgreSQL migrations.
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  status TEXT DEFAULT 'Active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id INTEGER,
  brand TEXT,
  uom TEXT,
  supplier_id INTEGER,
  minimum_stock INTEGER DEFAULT 0,
  maximum_stock INTEGER DEFAULT 0,
  weight NUMERIC DEFAULT 0,
  volume NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS warehouses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  status TEXT DEFAULT 'Active'
);

CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  warehouse_id INTEGER NOT NULL,
  location_code TEXT NOT NULL,
  zone TEXT,
  rack TEXT,
  level TEXT,
  bin TEXT,
  capacity INTEGER DEFAULT 0,
  current_occupancy INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Available',
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
);

CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  warehouse_id INTEGER NOT NULL,
  location_id INTEGER,
  physical_qty INTEGER DEFAULT 0,
  reserved_qty INTEGER DEFAULT 0,
  available_qty INTEGER DEFAULT 0,
  status TEXT DEFAULT 'NORMAL',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_type TEXT NOT NULL,
  reference_id TEXT,
  product_id INTEGER,
  warehouse_id INTEGER,
  location_id INTEGER,
  qty_in INTEGER DEFAULT 0,
  qty_out INTEGER DEFAULT 0,
  balance INTEGER DEFAULT 0,
  user_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  party_name TEXT,
  recipient_name TEXT,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (location_id) REFERENCES locations(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS receiving (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receiving_code TEXT NOT NULL UNIQUE,
  po_number TEXT,
  supplier_id INTEGER,
  arrival_date TEXT,
  received_by INTEGER,
  status TEXT DEFAULT 'Pending',
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (received_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS receiving_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receiving_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  expected_qty INTEGER DEFAULT 0,
  received_qty INTEGER DEFAULT 0,
  accepted_qty INTEGER DEFAULT 0,
  rejected_qty INTEGER DEFAULT 0,
  condition TEXT,
  inspection_result TEXT,
  status TEXT DEFAULT 'Pending',
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (receiving_id) REFERENCES receiving(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS inspections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receiving_id INTEGER,
  receiving_item_id INTEGER,
  sku TEXT,
  product_name TEXT,
  received_qty INTEGER DEFAULT 0,
  accepted_qty INTEGER DEFAULT 0,
  rejected_qty INTEGER DEFAULT 0,
  condition TEXT,
  inspection_result TEXT,
  inspector_id INTEGER,
  inspection_date TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (receiving_id) REFERENCES receiving(id),
  FOREIGN KEY (receiving_item_id) REFERENCES receiving_items(id),
  FOREIGN KEY (inspector_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS putaways (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  putaway_code TEXT NOT NULL UNIQUE,
  receiving_id INTEGER,
  product_id INTEGER,
  warehouse_id INTEGER,
  location_id INTEGER,
  qty INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (receiving_id) REFERENCES receiving(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE TABLE IF NOT EXISTS putaway_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  putaway_id INTEGER,
  receiving_item_id INTEGER,
  product_id INTEGER,
  qty INTEGER DEFAULT 0,
  location_id INTEGER,
  status TEXT DEFAULT 'Pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (putaway_id) REFERENCES putaways(id),
  FOREIGN KEY (receiving_item_id) REFERENCES receiving_items(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_code TEXT NOT NULL UNIQUE,
  requester TEXT,
  order_date TEXT,
  required_date TEXT,
  priority TEXT,
  status TEXT DEFAULT 'Pending',
  created_by INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  qty INTEGER DEFAULT 0,
  picked_qty INTEGER DEFAULT 0,
  shipped_qty INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER,
  product_id INTEGER,
  quantity INTEGER DEFAULT 0,
  warehouse_id INTEGER,
  location_id INTEGER,
  status TEXT DEFAULT 'Reserved',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE TABLE IF NOT EXISTS pickings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  picking_code TEXT NOT NULL UNIQUE,
  order_id INTEGER,
  status TEXT DEFAULT 'Pending',
  created_by INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS picking_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  picking_id INTEGER,
  order_item_id INTEGER,
  product_id INTEGER,
  location_id INTEGER,
  qty INTEGER DEFAULT 0,
  actual_qty INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Pending',
  FOREIGN KEY (picking_id) REFERENCES pickings(id),
  FOREIGN KEY (order_item_id) REFERENCES order_items(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE TABLE IF NOT EXISTS checkings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  picking_id INTEGER,
  order_id INTEGER,
  product_id INTEGER,
  quantity INTEGER DEFAULT 0,
  condition TEXT,
  result TEXT DEFAULT 'Passed',
  checked_by INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (picking_id) REFERENCES pickings(id),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (checked_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS packing (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  packing_code TEXT NOT NULL UNIQUE,
  order_id INTEGER,
  package_quantity INTEGER DEFAULT 0,
  weight NUMERIC DEFAULT 0,
  dimensions TEXT,
  status TEXT DEFAULT 'Pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_code TEXT NOT NULL UNIQUE,
  order_id INTEGER,
  customer TEXT,
  courier TEXT,
  vehicle TEXT,
  driver TEXT,
  tracking_number TEXT,
  shipping_date TEXT,
  package_id INTEGER,
  status TEXT DEFAULT 'Ready to Ship',
  proof_of_delivery TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (package_id) REFERENCES packing(id)
);

CREATE TABLE IF NOT EXISTS returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_code TEXT NOT NULL UNIQUE,
  original_order_id INTEGER,
  sku TEXT,
  quantity INTEGER DEFAULT 0,
  reason TEXT,
  condition TEXT,
  inspection_result TEXT,
  location_id INTEGER,
  created_by INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (original_order_id) REFERENCES orders(id),
  FOREIGN KEY (location_id) REFERENCES locations(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS return_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id INTEGER,
  product_id INTEGER,
  quantity INTEGER DEFAULT 0,
  condition TEXT,
  status TEXT DEFAULT 'Pending',
  FOREIGN KEY (return_id) REFERENCES returns(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS stock_opnames (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opname_code TEXT NOT NULL UNIQUE,
  warehouse_id INTEGER,
  location_id INTEGER,
  system_qty INTEGER DEFAULT 0,
  physical_qty INTEGER DEFAULT 0,
  variance INTEGER DEFAULT 0,
  variance_percent NUMERIC DEFAULT 0,
  reason TEXT,
  status TEXT DEFAULT 'Draft',
  created_by INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (location_id) REFERENCES locations(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS stock_opname_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opname_id INTEGER,
  product_id INTEGER,
  system_qty INTEGER DEFAULT 0,
  physical_qty INTEGER DEFAULT 0,
  variance INTEGER DEFAULT 0,
  reason TEXT,
  FOREIGN KEY (opname_id) REFERENCES stock_opnames(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  adjustment_code TEXT NOT NULL UNIQUE,
  sku TEXT,
  location_id INTEGER,
  current_stock INTEGER DEFAULT 0,
  adjustment_qty INTEGER DEFAULT 0,
  final_stock INTEGER DEFAULT 0,
  reason TEXT,
  attachment TEXT,
  requested_by INTEGER,
  approved_by INTEGER,
  status TEXT DEFAULT 'Draft',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (location_id) REFERENCES locations(id),
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS quarantine_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER,
  warehouse_id INTEGER,
  location_id INTEGER,
  quantity INTEGER DEFAULT 0,
  reason TEXT,
  status TEXT DEFAULT 'Hold',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT,
  transaction_id TEXT,
  details TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  title TEXT,
  message TEXT,
  type TEXT DEFAULT 'info',
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
