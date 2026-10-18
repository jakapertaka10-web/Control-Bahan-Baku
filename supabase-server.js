require('dotenv').config();

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');
const morgan = require('morgan');

const app = express();
const port = Number(process.env.PORT || 3000);
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const isPlaceholderValue = value => !value || /replace-with|example-project|dummy|your-project-ref/i.test(String(value));
const demoMode = process.env.DEMO_MODE === 'true' || isPlaceholderValue(supabaseUrl) || isPlaceholderValue(serviceRoleKey);

if (process.env.NODE_ENV === 'production') {
  if (demoMode) throw new Error('Valid SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production.');
  if (!process.env.WMS_SESSION_SECRET) throw new Error('WMS_SESSION_SECRET is required in production.');
}

function makeDemoData() {
  const now = new Date();
  const iso = (offsetMinutes = 0) => new Date(now.getTime() + offsetMinutes * 60 * 1000).toISOString();
  return {
    roles: [{ id: 1, name: 'Warehouse Manager', description: 'Demo role' }],
    users: [{ id: 1, role_id: 1, name: 'Admin Gudang', email: 'admin@example.com', password_hash: bcrypt.hashSync('admin123', 10), status: 'Active', created_at: iso() }],
    categories: [
      { id: 1, name: 'Kain', description: 'Bahan kain' },
      { id: 2, name: 'Busa', description: 'Busa foam' },
      { id: 3, name: 'Kawat', description: 'Bahan kawat' },
      { id: 4, name: 'Aksesoris', description: 'Aksesoris' }
    ],
    suppliers: [
      { id: 1, supplier_code: 'SUP-001', name: 'PT Sumber Tekstil', contact_name: 'Budi', phone: '0812-0000-1111', email: 'supplier1@example.com', address: 'Bandung', status: 'Active', created_at: iso() },
      { id: 2, supplier_code: 'SUP-002', name: 'CV Foam Indonesia', contact_name: 'Sari', phone: '0812-0000-2222', email: 'supplier2@example.com', address: 'Bekasi', status: 'Active', created_at: iso() }
    ],
    products: [
      { id: 1, sku: 'RM-KAIN-TOP', name: 'Kain Top', category_id: 1, brand: 'Vera', uom: 'Meter', supplier_id: 1, minimum_stock: 120, maximum_stock: 500, weight: 0.15, volume: 0.2, status: 'Active', created_at: iso(), updated_at: iso() },
      { id: 2, sku: 'RM-BUSA-D17', name: 'Busa D17', category_id: 2, brand: 'Flex', uom: 'Lembar', supplier_id: 2, minimum_stock: 80, maximum_stock: 300, weight: 1.2, volume: 0.5, status: 'Active', created_at: iso(), updated_at: iso() },
      { id: 3, sku: 'RM-KAWAT-18', name: 'Kawat 18', category_id: 3, brand: 'SteelPro', uom: 'Kilogram', supplier_id: 1, minimum_stock: 60, maximum_stock: 250, weight: 2.5, volume: 0.8, status: 'Active', created_at: iso(), updated_at: iso() }
    ],
    warehouses: [{ id: 1, code: 'WH-01', name: 'Gudang Utama', address: 'Jakarta', status: 'Active' }],
    locations: [
      { id: 1, warehouse_id: 1, location_code: 'A-01-01', zone: 'A', rack: '01', level: '01', bin: '01', capacity: 500, current_occupancy: 0, status: 'Available' },
      { id: 2, warehouse_id: 1, location_code: 'B-02-03', zone: 'B', rack: '02', level: '03', bin: '03', capacity: 200, current_occupancy: 0, status: 'Available' }
    ],
    inventory: [
      { id: 1, product_id: 1, warehouse_id: 1, location_id: 1, physical_qty: 220, reserved_qty: 0, available_qty: 220, status: 'NORMAL', updated_at: iso() },
      { id: 2, product_id: 2, warehouse_id: 1, location_id: 2, physical_qty: 95, reserved_qty: 0, available_qty: 95, status: 'NORMAL', updated_at: iso() },
      { id: 3, product_id: 3, warehouse_id: 1, location_id: 1, physical_qty: 140, reserved_qty: 0, available_qty: 140, status: 'NORMAL', updated_at: iso() }
    ],
    inventory_transactions: [
      { id: 1, transaction_type: 'Barang Masuk', reference_id: 'RCV-2026-001', product_id: 1, warehouse_id: 1, location_id: 1, qty_in: 220, qty_out: 0, balance: 220, user_id: 1, created_at: iso(-60), notes: 'Demo receiving', party_name: 'PT Sumber Tekstil', recipient_name: null, admin_name: 'Admin Gudang' }
    ],
    activity_logs: [{ id: 1, user_id: 1, action: 'Login', transaction_id: 'AUTH', details: 'User signed in', created_at: iso() }],
    receiving: [{ id: 1, receiving_code: 'RCV-2026-001', po_number: 'PO-001', supplier_id: 1, arrival_date: new Date().toISOString().slice(0, 10), received_by: 1, status: 'Completed', notes: 'Demo receiving', created_at: iso(-60), updated_at: iso(-60) }],
    receiving_items: [{ id: 1, receiving_id: 1, product_id: 1, expected_qty: 220, received_qty: 220, accepted_qty: 220, rejected_qty: 0, condition: 'Good', inspection_result: 'Accepted', status: 'Completed', notes: '', created_at: iso(-60) }],
    inspections: [{ id: 1, receiving_id: 1, receiving_item_id: 1, sku: 'RM-KAIN-TOP', product_name: 'Kain Top', received_qty: 220, accepted_qty: 220, rejected_qty: 0, condition: 'Good', inspection_result: 'Accepted', inspector_id: 1, inspection_date: new Date().toISOString().slice(0, 10), notes: 'Demo QC', created_at: iso(-60) }],
    putaways: [{ id: 1, putaway_code: 'PUT-2026-001', receiving_id: 1, product_id: 1, warehouse_id: 1, location_id: 1, qty: 220, status: 'Completed', created_at: iso(-60), updated_at: iso(-60) }],
    putaway_items: [{ id: 1, putaway_id: 1, receiving_item_id: 1, product_id: 1, qty: 220, location_id: 1, status: 'Completed', created_at: iso(-60) }],
    quarantine_items: [],
    stock_opnames: [],
    stock_opname_items: [],
    stock_adjustments: [],
    orders: [],
    order_items: [],
    reservations: [],
    pickings: [],
    picking_items: [],
    shipments: [],
    shipment_items: [],
    returns: [],
    return_items: []
  };
}

function createDemoQuery(table, state) {
  const query = {
    table,
    filters: [],
    orderBy: null,
    limitCount: null,
    selectFields: '*',
    operation: null,
    operationValues: null,
    then: (resolve, reject) => Promise.resolve().then(() => ({ data: query.execute(), error: null })).then(resolve, reject),
    execute: () => {
      let data = [...(state[table] || [])];
      for (const filter of query.filters) {
        data = data.filter(row => {
          const value = row[filter.column];
          if (filter.operator === 'eq') return String(value ?? '') === String(filter.value ?? '');
          if (filter.operator === 'neq') return String(value ?? '') !== String(filter.value ?? '');
          if (filter.operator === 'in') return Array.isArray(filter.value) ? filter.value.includes(value) : String(value ?? '') === String(filter.value ?? '');
          return true;
        });
      }
      if (query.orderBy) {
        const { field, direction = 'asc' } = query.orderBy;
        data = [...data].sort((a, b) => {
          const av = a[field] ?? '';
          const bv = b[field] ?? '';
          const comparison = typeof av === 'number' && typeof bv === 'number'
            ? av - bv
            : String(av).localeCompare(String(bv));
          return direction === 'desc' ? -comparison : comparison;
        });
      }
      if (query.limitCount !== null) data = data.slice(0, query.limitCount);

      if (query.operation === 'insert') {
        const values = Array.isArray(query.operationValues) ? query.operationValues : [query.operationValues];
        data = values.map(value => {
          const nextId = Math.max(0, ...((state[table] || []).map(item => Number(item.id) || 0))) + 1;
          const row = {
            id: nextId,
            created_at: new Date().toISOString(),
            ...value
          };
          if (table === 'suppliers' && !row.supplier_code) row.supplier_code = `SUP-${String(nextId).padStart(3, '0')}`;
          state[table] = [...(state[table] || []), row];
          return row;
        });
      } else if (query.operation === 'update') {
        for (const row of data) Object.assign(row, query.operationValues);
      } else if (query.operation === 'delete') {
        const matched = new Set(data);
        state[table] = (state[table] || []).filter(row => !matched.has(row));
      }

      if (query.selectFields === '*') return data;
      const fields = query.selectFields.split(',').map(item => item.trim()).filter(Boolean);
      return data.map(row => {
        const selected = {};
        for (const field of fields) {
          const cleaned = field.replace(/\(.*\)/g, '').trim();
          if (cleaned) selected[cleaned] = row[cleaned];
          if (field.includes('categories(')) {
            const category = state.categories.find(item => item.id === row.category_id);
            selected.categories = category ? { name: category.name } : null;
          }
          if (field.includes('suppliers(')) {
            const supplier = state.suppliers.find(item => item.id === row.supplier_id);
            selected.suppliers = supplier ? { id: supplier.id, supplier_code: supplier.supplier_code, name: supplier.name, status: supplier.status } : null;
          }
          if (field.includes('warehouses(')) {
            const location = table === 'locations' ? row : state.locations.find(item => item.id === row.location_id);
            const warehouse = location ? state.warehouses.find(item => item.id === location.warehouse_id) : null;
            if (warehouse) selected.warehouses = { code: warehouse.code };
          }
          if (field.includes('locations(')) {
            const location = state.locations.find(item => item.id === row.location_id);
            const warehouse = location ? state.warehouses.find(item => item.id === location.warehouse_id) : null;
            selected.locations = location ? { location_code: location.location_code, warehouses: warehouse ? { code: warehouse.code } : null } : null;
          }
          if (field.includes('products(')) {
            const product = state.products.find(item => item.id === row.product_id);
            selected.products = product ? { sku: product.sku, name: product.name, uom: product.uom } : null;
          }
        }
        return selected;
      });
    },
    select: function (fields) { query.selectFields = fields; return query; },
    eq: function (column, value) { query.filters.push({ column, value, operator: 'eq' }); return query; },
    neq: function (column, value) { query.filters.push({ column, value, operator: 'neq' }); return query; },
    in: function (column, value) { query.filters.push({ column, value, operator: 'in' }); return query; },
    order: function (field, options = {}) { query.orderBy = { field, direction: options.ascending === false ? 'desc' : 'asc' }; return query; },
    limit: function (count) { query.limitCount = Math.max(0, Number(count) || 0); return query; },
    maybeSingle: async function () {
      const rows = query.execute();
      return { data: rows[0] || null, error: null };
    },
    insert: function (values) {
      query.operation = 'insert';
      query.operationValues = values;
      return query;
    },
    update: function (values) {
      query.operation = 'update';
      query.operationValues = values;
      return query;
    },
    delete: function () {
      query.operation = 'delete';
      return query;
    }
  };
  return query;
}

const demoState = makeDemoData();

function getDemoInventoryRows() {
  return demoState.products.filter(product => product.status === 'Active').flatMap(product => {
    const stocks = demoState.inventory.filter(item => item.product_id === product.id);
    const totalQty = stocks.reduce((sum, item) => sum + Number(item.physical_qty || 0), 0);
    const category = demoState.categories.find(item => item.id === product.category_id)?.name || null;
    const locationList = stocks.map(item => demoState.locations.find(location => location.id === item.location_id)?.location_code).filter(Boolean);
    const rows = stocks.length ? stocks : [null];
    return rows.map(stock => {
      const location = stock && demoState.locations.find(item => item.id === stock.location_id);
      const warehouse = location && demoState.warehouses.find(item => item.id === location.warehouse_id);
      return {
        inventory_id: stock?.id ?? null,
        product_id: product.id,
        sku: product.sku,
        product_name: product.name,
        name: product.name,
        category,
        uom: product.uom,
        warehouse_code: warehouse?.code || null,
        location_code: location?.location_code || null,
        physical_qty: Number(stock?.physical_qty || 0),
        available_qty: Number(stock?.physical_qty || 0),
        minimum_stock: Number(product.minimum_stock || 0),
        status: totalQty === 0 ? 'OUT OF STOCK' : totalQty <= Number(product.minimum_stock || 0) ? 'LOW STOCK' : 'NORMAL',
        quarantine_qty: 0,
        updated_at: stock?.updated_at || product.updated_at,
        qty: totalQty,
        locations: locationList.join(', ')
      };
    });
  }).concat(demoState.quarantine_items.filter(item => item.status === 'Hold').map(item => {
    const product = demoState.products.find(row => row.id === item.product_id);
    const location = demoState.locations.find(row => row.id === item.location_id);
    const warehouse = location && demoState.warehouses.find(row => row.id === location.warehouse_id);
    return {
      inventory_id: null, product_id: product.id, sku: product.sku, product_name: product.name, name: product.name,
      category: demoState.categories.find(row => row.id === product.category_id)?.name || null, uom: product.uom,
      warehouse_code: warehouse?.code || null, location_code: location?.location_code || null,
      physical_qty: 0, available_qty: 0, minimum_stock: Number(product.minimum_stock || 0),
      status: 'QUARANTINE', quarantine_qty: Number(item.quantity), updated_at: item.created_at,
      qty: 0, locations: location?.location_code || ''
    };
  }));
}

function getDemoMovementRows(params = {}) {
  const rows = demoState.inventory_transactions.map(transaction => {
    const product = demoState.products.find(item => item.id === transaction.product_id);
    const location = demoState.locations.find(item => item.id === transaction.location_id);
    const user = demoState.users.find(item => item.id === transaction.user_id);
    return {
      ...transaction,
      sku: product?.sku || null,
      product_name: product?.name || null,
      uom: product?.uom || null,
      location_code: location?.location_code || null,
      admin_name: transaction.admin_name || user?.name || null
    };
  });
  const includes = (value, term) => !term || String(value || '').toLowerCase().includes(String(term).toLowerCase());
  return rows.filter(row => {
    const date = row.created_at?.slice(0, 10);
    const search = [row.reference_id, row.sku, row.product_name, row.party_name, row.recipient_name, row.location_code, row.admin_name].join(' ');
    return (!params.p_from || date >= params.p_from) &&
      (!params.p_to || date <= params.p_to) &&
      (!params.p_type || row.transaction_type === params.p_type) &&
      (!params.p_product || row.sku === params.p_product || includes(row.product_name, params.p_product)) &&
      (!params.p_location || row.location_code === params.p_location) &&
      includes(row.admin_name, params.p_admin) && includes(search, params.p_search);
  }).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 1000);
}

function addDemoTransaction(transaction) {
  const id = Math.max(0, ...demoState.inventory_transactions.map(row => Number(row.id) || 0)) + 1;
  const row = { id, created_at: new Date().toISOString(), ...transaction };
  demoState.inventory_transactions.push(row);
  return row;
}

function createDemoRpcError(message) {
  const error = new Error(message);
  error.code = 'P0001';
  return error;
}

const demoSupabase = {
  from: table => createDemoQuery(table, demoState),
  channel: () => ({
    on: () => ({ subscribe: () => null })
  }),
  rpc: async (name, params = {}) => {
    const inventoryRows = getDemoInventoryRows();
    const movementRows = getDemoMovementRows();
    const inventory = demoState.inventory.map(stock => {
      const row = inventoryRows.find(item => item.inventory_id === stock.id);
      return row || null;
    }).filter(Boolean);
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const todayTransactions = movementRows.filter(row => row.created_at?.slice(0, 10) === today);
    const productQty = new Map(demoState.products.map(product => [
      product.id,
      demoState.inventory.filter(stock => stock.product_id === product.id).reduce((sum, stock) => sum + Number(stock.physical_qty || 0), 0)
    ]));
    const dashboardStats = {
      material_count: demoState.products.filter(item => item.status === 'Active').length,
      physical_total: [...productQty.values()].reduce((sum, qty) => sum + qty, 0),
      low_stock: demoState.products.filter(product => product.status === 'Active' && productQty.get(product.id) > 0 && productQty.get(product.id) <= Number(product.minimum_stock || 0)).length,
      out_of_stock: demoState.products.filter(product => product.status === 'Active' && productQty.get(product.id) === 0).length,
      incoming_today: todayTransactions.filter(row => row.transaction_type.startsWith('Barang Masuk')).reduce((sum, row) => sum + Number(row.qty_in || 0), 0),
      outgoing_today: todayTransactions.filter(row => row.transaction_type.startsWith('Barang Keluar')).reduce((sum, row) => sum + Number(row.qty_out || 0), 0),
      transactions_today: todayTransactions.length
    };
    const dashboard = {
      stats: dashboardStats,
      inventory: demoState.products.filter(item => item.status === 'Active').map(product => {
        const row = inventoryRows.find(item => item.product_id === product.id && item.status !== 'QUARANTINE');
        return { name: product.name, qty: productQty.get(product.id) || 0, minimum_stock: Number(product.minimum_stock || 0), ...row };
      }),
      categories: demoState.categories.map(category => ({
        category: category.name,
        quantity: demoState.products.filter(product => product.category_id === category.id).reduce((sum, product) => sum + (productQty.get(product.id) || 0), 0)
      })).filter(item => item.quantity > 0),
      recent: movementRows.slice(0, 10),
      low_stock: demoState.products.filter(product => product.status === 'Active' && (productQty.get(product.id) || 0) <= Number(product.minimum_stock || 0))
        .map(product => ({ name: product.name, sku: product.sku, qty: productQty.get(product.id) || 0, uom: product.uom, minimum_stock: product.minimum_stock, locations: inventoryRows.filter(row => row.product_id === product.id && row.status !== 'QUARANTINE').map(row => row.location_code).filter(Boolean).join(', ') })),
      movements: (() => {
        const days = params.p_period === 'month' ? now.getDate() : params.p_period === '30d' ? 30 : 7;
        return Array.from({ length: days }, (_, index) => {
        const day = params.p_period === 'month'
          ? new Date(now.getFullYear(), now.getMonth(), index + 1)
          : new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + index + 1);
          const key = day.toISOString().slice(0, 10);
          const matching = movementRows.filter(row => row.created_at?.slice(0, 10) === key);
          return {
            day: day.toLocaleDateString('id-ID', { weekday: 'short' }),
            qty_in: matching.filter(row => row.transaction_type.startsWith('Barang Masuk')).reduce((sum, row) => sum + Number(row.qty_in || 0), 0),
            qty_out: matching.filter(row => row.transaction_type.startsWith('Barang Keluar')).reduce((sum, row) => sum + Number(row.qty_out || 0), 0)
          };
        });
      })(),
      activity_today: ['Barang Masuk', 'Barang Keluar', 'Stock Opname', 'Adjustment'].map(type => ({
        type,
        count: todayTransactions.filter(row => type === 'Barang Masuk' ? row.transaction_type.startsWith(type) : type === 'Barang Keluar' ? row.transaction_type.startsWith(type) : row.transaction_type === type).length
      }))
    };
    const receivingRows = demoState.receiving_items.map(item => {
      const receiving = demoState.receiving.find(row => row.id === item.receiving_id);
      const supplier = receiving && demoState.suppliers.find(row => row.id === receiving.supplier_id);
      const product = demoState.products.find(row => row.id === item.product_id);
      return {
        item_id: item.id, receiving_id: receiving?.id, receiving_code: receiving?.receiving_code,
        po_number: receiving?.po_number, arrival_date: receiving?.arrival_date, supplier_id: supplier?.id,
        supplier_code: supplier?.supplier_code, supplier_name: supplier?.name, product_id: product?.id,
        sku: product?.sku, product_name: product?.name, uom: product?.uom, received_qty: item.received_qty,
        accepted_qty: item.accepted_qty, rejected_qty: item.rejected_qty, condition: item.condition,
        inspection_result: item.inspection_result, status: item.status, notes: item.notes || receiving?.notes
      };
    }).sort((a, b) => b.item_id - a.item_id);
    const nextId = table => Math.max(0, ...((demoState[table] || []).map(item => Number(item.id) || 0))) + 1;
    const getStock = (productId, locationId) => demoState.inventory.find(row => row.product_id === productId && row.location_id === locationId);
    const ensureStock = (product, location) => {
      let stock = getStock(product.id, location.id);
      if (!stock) {
        stock = { id: nextId('inventory'), product_id: product.id, warehouse_id: location.warehouse_id, location_id: location.id, physical_qty: 0, reserved_qty: 0, available_qty: 0, status: 'NORMAL', updated_at: new Date().toISOString() };
        demoState.inventory.push(stock);
      }
      return stock;
    };
    const updateStock = (stock, quantity) => {
      stock.physical_qty = quantity;
      stock.available_qty = quantity;
      stock.reserved_qty = 0;
      stock.updated_at = new Date().toISOString();
    };
    const addActivityRow = (userId, action, reference, details) => {
      demoState.activity_logs.push({ id: nextId('activity_logs'), user_id: userId || null, action, transaction_id: reference || null, details: details || '', created_at: new Date().toISOString() });
    };
    try {
      switch (name) {
        case 'wms_dashboard_payload':
          return { data: dashboard, error: null };
        case 'wms_receiving_rows':
          return { data: receivingRows.filter(row => !params.p_search || [row.po_number, row.receiving_code, row.supplier_name, row.sku, row.product_name].join(' ').toLowerCase().includes(String(params.p_search).toLowerCase())).slice(0, 150), error: null };
        case 'wms_create_receiving': {
          const product = demoState.products.find(row => row.id === Number(params.p_product_id) && row.status === 'Active');
          const supplier = demoState.suppliers.find(row => row.id === Number(params.p_supplier_id) && row.status === 'Active');
          const quantity = Number(params.p_received_qty);
          if (!product || !supplier) throw createDemoRpcError('Bahan baku dan supplier harus aktif.');
          if (!Number.isFinite(quantity) || quantity <= 0 || !String(params.p_po_number || '').trim()) throw createDemoRpcError('Nomor PO dan jumlah penerimaan valid wajib diisi.');
          const id = nextId('receiving');
          const code = `RCV-DEMO-${Date.now()}`;
          demoState.receiving.push({ id, receiving_code: code, po_number: params.p_po_number, supplier_id: supplier.id, arrival_date: params.p_arrival_date, received_by: params.p_user_id, status: 'Inspection', notes: params.p_notes || null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
          const itemId = nextId('receiving_items');
          demoState.receiving_items.push({ id: itemId, receiving_id: id, product_id: product.id, expected_qty: quantity, received_qty: quantity, accepted_qty: 0, rejected_qty: 0, condition: params.p_condition, inspection_result: null, status: 'Pending', notes: params.p_notes || null, created_at: new Date().toISOString() });
          addActivityRow(params.p_user_id, 'Receiving', code, `${product.sku}: ${quantity} ${product.uom}`);
          return { data: { receiving_id: id, receiving_code: code }, error: null };
        }
        case 'wms_complete_putaway': {
          const item = demoState.receiving_items.find(row => row.id === Number(params.p_receiving_item_id) && row.status === 'Pending');
          const receiving = item && demoState.receiving.find(row => row.id === item.receiving_id);
          const product = item && demoState.products.find(row => row.id === item.product_id);
          const supplier = receiving && demoState.suppliers.find(row => row.id === receiving.supplier_id);
          const location = demoState.locations.find(row => row.id === Number(params.p_location_id) && row.status !== 'Blocked');
          const accepted = Number(params.p_accepted_qty);
          const rejected = Number(params.p_rejected_qty);
          if (!item || !product || !location) throw createDemoRpcError('Penerimaan atau lokasi tidak valid / sudah diproses.');
          if (!Number.isFinite(accepted) || !Number.isFinite(rejected) || accepted < 0 || rejected < 0 || Math.abs(accepted + rejected - Number(item.received_qty)) > 0.000001) throw createDemoRpcError('Jumlah accepted dan rejected harus sama dengan jumlah diterima.');
          const stock = ensureStock(product, location);
          const before = Number(stock.physical_qty);
          const qcResult = accepted === 0 ? 'Ditolak' : rejected === 0 ? 'Diterima' : 'Sebagian Diterima';
          item.accepted_qty = accepted;
          item.rejected_qty = rejected;
          item.inspection_result = qcResult;
          item.status = 'Completed';
          item.notes = params.p_notes || item.notes;
          demoState.inspections.push({ id: nextId('inspections'), receiving_id: receiving.id, receiving_item_id: item.id, sku: product.sku, product_name: product.name, received_qty: item.received_qty, accepted_qty: accepted, rejected_qty: rejected, condition: item.condition, inspection_result: qcResult, inspector_id: params.p_user_id, inspection_date: new Date().toISOString(), notes: params.p_notes || null, created_at: new Date().toISOString() });
          if (rejected > 0) {
            demoState.quarantine_items.push({ id: nextId('quarantine_items'), product_id: product.id, warehouse_id: location.warehouse_id, location_id: location.id, quantity: rejected, reason: `Ditolak QC: ${params.p_notes || item.condition || 'Perlu pemeriksaan'}`, status: 'Hold', created_at: new Date().toISOString() });
            addDemoTransaction({ transaction_type: 'Quarantine', reference_id: `QTN-${receiving.id}`, product_id: product.id, warehouse_id: location.warehouse_id, location_id: location.id, qty_in: 0, qty_out: 0, balance: before, user_id: params.p_user_id, notes: `QC rejected ${rejected} ${product.uom}`, party_name: supplier?.name || null, recipient_name: null });
          }
          let putawayId = null;
          if (accepted > 0) {
            const putawayCode = `PA-DEMO-${Date.now()}`;
            putawayId = nextId('putaways');
            demoState.putaways.push({ id: putawayId, putaway_code: putawayCode, receiving_id: receiving.id, product_id: product.id, warehouse_id: location.warehouse_id, location_id: location.id, qty: accepted, status: 'Completed', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
            demoState.putaway_items.push({ id: nextId('putaway_items'), putaway_id: putawayId, receiving_item_id: item.id, product_id: product.id, qty: accepted, location_id: location.id, status: 'Completed', created_at: new Date().toISOString() });
            updateStock(stock, before + accepted);
            addDemoTransaction({ transaction_type: 'Barang Masuk / Put Away', reference_id: putawayCode, product_id: product.id, warehouse_id: location.warehouse_id, location_id: location.id, qty_in: accepted, qty_out: 0, balance: stock.physical_qty, user_id: params.p_user_id, notes: params.p_notes || null, party_name: supplier?.name || null, recipient_name: null });
          }
          receiving.status = demoState.receiving_items.some(row => row.receiving_id === receiving.id && row.status === 'Pending') ? 'Inspection' : 'Completed';
          receiving.updated_at = new Date().toISOString();
          addActivityRow(params.p_user_id, 'Inspection & Put Away', receiving.receiving_code, `${product.sku}: ${qcResult}`);
          return { data: { accepted_qty: accepted, rejected_qty: rejected, physical_before: before, physical_after: before + accepted, inspection_result: qcResult, putaway_id: putawayId }, error: null };
        }
        case 'wms_issue_options': {
          const search = String(params.p_search || '').toLowerCase();
          const options = inventory.filter(row => row.inventory_id !== null && demoState.products.find(product => product.id === row.product_id)?.status === 'Active' && demoState.locations.find(location => location.location_code === row.location_code)?.status !== 'Blocked')
            .filter(row => !search || `${row.sku} ${row.product_name} ${row.location_code}`.toLowerCase().includes(search))
            .map(row => ({ inventory_id: row.inventory_id, product_id: row.product_id, warehouse_id: demoState.inventory.find(item => item.id === row.inventory_id)?.warehouse_id, location_id: demoState.inventory.find(item => item.id === row.inventory_id)?.location_id, sku: row.sku, product_name: row.product_name, uom: row.uom, warehouse_code: row.warehouse_code, location_code: row.location_code, physical_qty: row.physical_qty }));
          return { data: options, error: null };
        }
        case 'wms_issue_history':
          return { data: movementRows.filter(row => row.transaction_type === 'Barang Keluar / Issue to Production' && (!params.p_search || `${row.reference_id} ${row.sku} ${row.product_name} ${row.party_name} ${row.recipient_name} ${row.location_code} ${row.admin_name}`.toLowerCase().includes(String(params.p_search).toLowerCase()))).slice(0, 150), error: null };
        case 'wms_issue_to_production': {
          const stock = demoState.inventory.find(row => row.id === Number(params.p_inventory_id));
          const product = stock && demoState.products.find(row => row.id === stock.product_id && row.status === 'Active');
          const location = stock && demoState.locations.find(row => row.id === stock.location_id && row.status !== 'Blocked');
          const quantity = Number(params.p_qty);
          const purpose = String(params.p_purpose || '').trim();
          const recipient = String(params.p_recipient || '').trim();
          if (!stock || !product || !location) throw createDemoRpcError('Baris stok tidak ditemukan atau bahan/lokasi tidak aktif.');
          if (!Number.isFinite(quantity) || quantity <= 0) throw createDemoRpcError('Jumlah keluar harus lebih dari nol.');
          if (!purpose || !recipient) throw createDemoRpcError('Tujuan produksi dan nama penerima wajib diisi.');
          const before = Number(stock.physical_qty);
          if (before < quantity) throw createDemoRpcError(`Stok tidak cukup. Tersedia ${before} ${product.uom}.`);
          const after = before - quantity;
          updateStock(stock, after);
          const reference = `ISS-DEMO-${Date.now()}`;
          addDemoTransaction({ transaction_type: 'Barang Keluar / Issue to Production', reference_id: reference, product_id: product.id, warehouse_id: stock.warehouse_id, location_id: location.id, qty_in: 0, qty_out: quantity, balance: after, user_id: params.p_user_id, notes: params.p_notes || null, party_name: purpose, recipient_name: recipient });
          addActivityRow(params.p_user_id, 'Barang Keluar / Issue to Production', reference, `${product.sku}: ${quantity} ${product.uom}`);
          return { data: { reference_id: reference, physical_before: before, physical_after: after }, error: null };
        }
        case 'wms_inventory_rows': {
          const filtered = inventoryRows.filter(row => (!params.p_search || `${row.sku} ${row.product_name} ${row.location_code}`.toLowerCase().includes(String(params.p_search).toLowerCase())) &&
            (!params.p_category || row.category === params.p_category) && (!params.p_location || row.location_code === params.p_location) &&
            (!params.p_status || row.status === params.p_status));
          return { data: filtered, error: null };
        }
        case 'wms_movement_rows':
          return { data: getDemoMovementRows(params), error: null };
        case 'wms_stock_opname': {
          const product = demoState.products.find(row => row.id === Number(params.p_product_id) && row.status === 'Active');
          const location = demoState.locations.find(row => row.id === Number(params.p_location_id));
          const physical = Number(params.p_physical_qty);
          if (!product || !location || !Number.isFinite(physical) || physical < 0) throw createDemoRpcError('Bahan, lokasi, atau stok fisik tidak valid.');
          const stock = ensureStock(product, location);
          const before = Number(stock.physical_qty);
          const variance = physical - before;
          const reason = String(params.p_reason || '').trim();
          if (variance !== 0 && !reason) throw createDemoRpcError('Alasan wajib diisi jika ada selisih.');
          const reference = `OPN-DEMO-${Date.now()}`;
          const opnameId = nextId('stock_opnames');
          demoState.stock_opnames.push({ id: opnameId, opname_code: reference, warehouse_id: location.warehouse_id, location_id: location.id, system_qty: before, physical_qty: physical, variance, variance_percent: before === 0 ? (variance === 0 ? 0 : 100) : Math.round(Math.abs(variance) / before * 10000) / 100, reason: reason || 'Tidak ada selisih', status: 'Completed', created_by: params.p_user_id, created_at: new Date().toISOString() });
          demoState.stock_opname_items.push({ id: nextId('stock_opname_items'), opname_id: opnameId, product_id: product.id, system_qty: before, physical_qty: physical, variance, reason: reason || null });
          updateStock(stock, physical);
          addDemoTransaction({ transaction_type: 'Stock Opname', reference_id: reference, product_id: product.id, warehouse_id: location.warehouse_id, location_id: location.id, qty_in: Math.max(variance, 0), qty_out: Math.max(-variance, 0), balance: physical, user_id: params.p_user_id, notes: reason || 'Stok terverifikasi tanpa selisih', party_name: null, recipient_name: null });
          addActivityRow(params.p_user_id, 'Stock Opname', reference, `${product.sku}: selisih ${variance} ${product.uom}`);
          return { data: { opname_code: reference, system_qty: before, physical_qty: physical, variance }, error: null };
        }
        case 'wms_adjust_stock': {
          const product = demoState.products.find(row => row.id === Number(params.p_product_id) && row.status === 'Active');
          const location = demoState.locations.find(row => row.id === Number(params.p_location_id));
          const adjustment = Number(params.p_adjustment_qty);
          const reason = String(params.p_reason || '').trim();
          if (!product || !location || !Number.isFinite(adjustment) || adjustment === 0 || !reason) throw createDemoRpcError('Adjustment, bahan, lokasi, dan alasan harus valid.');
          const stock = ensureStock(product, location);
          const before = Number(stock.physical_qty);
          const after = before + adjustment;
          if (after < 0) throw createDemoRpcError('Adjustment menghasilkan stok negatif.');
          const reference = `ADJ-DEMO-${Date.now()}`;
          demoState.stock_adjustments.push({ id: nextId('stock_adjustments'), adjustment_code: reference, sku: product.sku, location_id: location.id, current_stock: before, adjustment_qty: adjustment, final_stock: after, reason, requested_by: params.p_user_id, status: 'Completed', created_at: new Date().toISOString() });
          updateStock(stock, after);
          addDemoTransaction({ transaction_type: 'Adjustment', reference_id: reference, product_id: product.id, warehouse_id: location.warehouse_id, location_id: location.id, qty_in: Math.max(adjustment, 0), qty_out: Math.max(-adjustment, 0), balance: after, user_id: params.p_user_id, notes: reason, party_name: null, recipient_name: null });
          addActivityRow(params.p_user_id, 'Adjustment', reference, `${product.sku}: ${adjustment} ${product.uom}`);
          return { data: { adjustment_code: reference, physical_before: before, physical_after: after }, error: null };
        }
        case 'wms_opname_rows':
          return { data: demoState.stock_opnames.map(opname => {
            const item = demoState.stock_opname_items.find(row => row.opname_id === opname.id);
            const product = demoState.products.find(row => row.id === item?.product_id);
            const location = demoState.locations.find(row => row.id === opname.location_id);
            const warehouse = location && demoState.warehouses.find(row => row.id === location.warehouse_id);
            const user = demoState.users.find(row => row.id === opname.created_by);
            return { opname_code: opname.opname_code, created_at: opname.created_at, system_qty: opname.system_qty, physical_qty: opname.physical_qty, variance: opname.variance, variance_percent: opname.variance_percent, reason: opname.reason, sku: product?.sku, product_name: product?.name, uom: product?.uom, warehouse_code: warehouse?.code, location_code: location?.location_code, admin_name: user?.name || 'Admin Gudang' };
          }).sort((a, b) => b.created_at.localeCompare(a.created_at)), error: null };
        case 'wms_report_payload': {
          const transactions = getDemoMovementRows();
          return { data: {
            inventory: inventoryRows,
            inbound: transactions.filter(row => row.transaction_type.startsWith('Barang Masuk')).map(row => ({ supplier_name: row.party_name, receiving_count: 1, quantity: row.qty_in, uom: row.uom })),
            outbound: transactions.filter(row => row.transaction_type.startsWith('Barang Keluar')).map(row => ({ purpose: row.party_name, recipient: row.recipient_name, transaction_count: 1, total_qty: row.qty_out, uom: row.uom })),
            movement: [...new Set(transactions.map(row => row.transaction_type))].map(type => {
              const matching = transactions.filter(row => row.transaction_type === type);
              return { transaction_type: type, count: matching.length, total_in: matching.reduce((sum, row) => sum + Number(row.qty_in || 0), 0), total_out: matching.reduce((sum, row) => sum + Number(row.qty_out || 0), 0) };
            }),
            opnames: demoState.stock_opnames.map(opname => {
              const item = demoState.stock_opname_items.find(row => row.opname_id === opname.id);
              const product = demoState.products.find(row => row.id === item?.product_id);
              const user = demoState.users.find(row => row.id === opname.created_by);
              return { ...opname, sku: product?.sku, name: product?.name, uom: product?.uom, admin_name: user?.name || 'Admin Gudang' };
            })
          }, error: null };
        }
        default:
          return { data: null, error: new Error(`Demo mode does not implement RPC: ${name}`) };
      }
    } catch (error) {
      return { data: null, error };
    }
  }
};

const supabase = demoMode ? demoSupabase : createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});
const sseClients = new Set();
const materialUnits = new Map([
  ['RM-KAIN-TOP', 'Meter'], ['RM-KAIN-BOT', 'Meter'], ['RM-KAIN-SID', 'Meter'], ['RM-COTTON', 'Meter'],
  ['RM-BUSA-D17', 'Lembar'], ['RM-BUSA-D18', 'Lembar'], ['RM-BUSA-D25', 'Lembar'],
  ['RM-KAWAT-18', 'Kilogram'], ['RM-KAWAT-20', 'Kilogram'], ['RM-KAWAT-22', 'Kilogram'],
  ['RM-BENANG-H', 'Roll'], ['RM-BENANG-P', 'Roll'], ['RM-WEB-H', 'Roll'], ['RM-WEB-N', 'Roll']
]);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.WMS_SESSION_SECRET || 'local-development-only-change-before-deploy',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 12, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }
}));

const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function safeJson(value) {
  return JSON.stringify(value ?? null).replace(/</g, '\\u003c');
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatStatus(value) {
  const normalized = String(value || '').toLowerCase();
  const classes = {
    normal: 'green', active: 'green', completed: 'green', accepted: 'green',
    pending: 'orange', inspection: 'orange', 'low stock': 'orange',
    rejected: 'red', quarantine: 'red', 'out of stock': 'red',
    'barang masuk / put away': 'green', 'barang keluar / issue to production': 'blue',
    adjustment: 'blue', 'stock opname': 'blue'
  };
  return `<span class="status-pill ${classes[normalized] || 'gray'}">${escapeHtml(value || 'Unknown')}</span>`;
}

function renderPage({ title, user, active, content }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: '▣' },
    { id: 'products', label: 'Master Bahan Baku', path: '/products', icon: '◫' },
    { id: 'suppliers', label: 'Master Supplier', path: '/suppliers', icon: '▤' },
    { id: 'receivings', label: 'Barang Masuk', path: '/receivings', icon: '⇣' },
    { id: 'issues', label: 'Barang Keluar', path: '/issues', icon: '⇡' },
    { id: 'inventory', label: 'Stok Gudang', path: '/inventory', icon: '▦' },
    { id: 'stock-movement', label: 'Stock Movement', path: '/stock-movement', icon: '⇄' },
    { id: 'stock-opname', label: 'Stock Opname', path: '/stock-opname', icon: '∑' },
    { id: 'reports', label: 'Laporan', path: '/reports', icon: '▥' }
  ];
  const nav = navItems.map(item => `<a class="nav-item ${active === item.id ? 'active' : ''}" href="${item.path}"><span class="nav-icon">${item.icon}</span><span>${item.label}</span></a>`).join('');
  return `<!doctype html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><link rel="stylesheet" href="/styles.css"></head><body><div class="app-shell"><aside class="sidebar"><div class="logo"><div class="logo-mark">W</div><div class="brand-name">Mattress Materials</div></div><nav class="nav-section">${nav}</nav></aside><main class="main-panel"><header class="topbar"><h1>${escapeHtml(title)}</h1><div class="topbar-actions"><span class="badge">${escapeHtml(user?.name)} • ${escapeHtml(user?.role_name)}</span><a href="/logout" class="btn btn-secondary btn-small">Logout</a></div></header><div class="page-body">${content}</div></main></div><script src="/app.js"></script></body></html>`;
}

function renderMessage(req, title, message, status = 400, back = '/dashboard') {
  return req.res.status(status).send(renderPage({
    title, user: req.session.user, active: '',
    content: `<section class="panel"><h3>${escapeHtml(message)}</h3><a class="btn btn-secondary" href="${back}">Kembali</a></section>`
  }));
}

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

async function getRows(table, select = '*', configure = query => query) {
  const { data, error } = await configure(supabase.from(table).select(select));
  if (error) throw error;
  return data || [];
}

async function rpc(name, params = {}) {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return data;
}

async function addActivity(userId, action, transactionId, details) {
  const { error } = await supabase.from('activity_logs').insert({
    user_id: userId || null, action, transaction_id: transactionId || null, details: details || ''
  });
  if (error) console.error('Activity log write failed:', error.message);
}

function getMovementParams(query) {
  return {
    p_from: /^\d{4}-\d{2}-\d{2}$/.test(query.from || '') ? query.from : null,
    p_to: /^\d{4}-\d{2}-\d{2}$/.test(query.to || '') ? query.to : null,
    p_type: query.type || null,
    p_product: query.product || null,
    p_location: query.location || null,
    p_admin: query.admin || null,
    p_search: query.search || null
  };
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function sendCsv(res, filename, columns, rows) {
  const csv = '\ufeff' + [columns.map(column => csvCell(column.label)).join(','), ...rows.map(row => columns.map(column => csvCell(column.value(row))).join(','))].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

function ledgerColumns() {
  return [
    { label: 'Tanggal/waktu', value: row => row.created_at },
    { label: 'Nomor referensi', value: row => row.reference_id },
    { label: 'Tipe transaksi', value: row => row.transaction_type },
    { label: 'Kode bahan', value: row => row.sku },
    { label: 'Nama bahan', value: row => row.product_name },
    { label: 'Satuan', value: row => row.uom },
    { label: 'Lokasi', value: row => row.location_code },
    { label: 'Qty masuk', value: row => row.qty_in },
    { label: 'Qty keluar', value: row => row.qty_out },
    { label: 'Stok akhir', value: row => row.balance },
    { label: 'Supplier/tujuan produksi', value: row => row.party_name },
    { label: 'Penerima', value: row => row.recipient_name },
    { label: 'Nama admin', value: row => row.admin_name },
    { label: 'Catatan', value: row => row.notes }
  ];
}

app.get('/', (req, res) => res.redirect(req.session.user ? '/dashboard' : '/login'));

app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  const demoNotice = demoMode ? '<p class="inline-note">Mode demo lokal. Login: admin@example.com / admin123. Data contoh direset saat server dimulai ulang.</p>' : '';
  res.send(`<!doctype html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WMS Login</title><link rel="stylesheet" href="/styles.css"></head><body><div class="login-shell"><section class="login-card"><div class="logo"><div class="logo-mark">W</div><div class="brand-name">Warehouse Management System</div></div><h2>Sign in</h2><p class="inline-note">Operasional gudang bahan baku mattress</p>${demoNotice}<form method="POST" action="/login"><div class="field"><label>Email</label><input name="email" type="email" required autocomplete="username"></div><div class="field" style="margin-top:14px"><label>Password</label><input name="password" type="password" required autocomplete="current-password"></div><div class="form-actions"><button class="btn btn-primary" type="submit">Login</button></div></form></section></div></body></html>`);
});

app.post('/login', asyncRoute(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const rawPassword = String(req.body.password || '');
  let user = null;
  let role = null;

  if (demoMode) {
    user = demoState.users.find(item => item.email.toLowerCase() === email) || null;
    if (user && user.status === 'Active' && bcrypt.compareSync(rawPassword, user.password_hash)) {
      role = demoState.roles.find(item => item.id === user.role_id) || null;
    } else {
      user = null;
    }
  } else {
    const { data, error } = await supabase.from('users').select('id,name,email,password_hash,status,role_id').eq('email', email).maybeSingle();
    if (error) throw error;
    user = data;
    if (user && user.status === 'Active' && bcrypt.compareSync(rawPassword, user.password_hash)) {
      const { data: roleData, error: roleError } = await supabase.from('roles').select('name').eq('id', user.role_id).maybeSingle();
      if (roleError) throw roleError;
      role = roleData;
    } else {
      user = null;
    }
  }

  if (!user || user.status !== 'Active' || !bcrypt.compareSync(rawPassword, user.password_hash)) {
    const demoNotice = demoMode ? '<p class="inline-note">Login demo: admin@example.com / admin123</p>' : '';
    return res.status(401).send(`<!doctype html><html lang="id"><head><meta charset="UTF-8"><link rel="stylesheet" href="/styles.css"><title>Login</title></head><body><div class="login-shell"><section class="login-card"><h2>Login gagal</h2><p>Email atau password tidak valid.</p>${demoNotice}<a class="btn btn-secondary" href="/login">Kembali</a></section></div></body></html>`);
  }

  req.session.user = { id: user.id, name: user.name, email: user.email, role_name: role?.name || 'Warehouse Staff' };
  await addActivity(user.id, 'Login', 'AUTH', 'User signed in');
  res.redirect('/dashboard');
}));

app.get('/logout', (req, res) => {
  if (req.session.user) addActivity(req.session.user.id, 'Logout', 'AUTH', 'User signed out');
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/events', requireAuth, (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write('event: connected\ndata: {}\n\n');
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

function renderDashboard(payload, user, period = '7d') {
  const stats = payload.stats || {};
  const inventory = payload.inventory || [];
  const categories = payload.categories || [];
  const recent = payload.recent || [];
  const lowStock = payload.low_stock || [];
  const categoryTotal = categories.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const kpis = [
    ['Total Jenis Bahan Baku', stats.material_count, 'jenis aktif', 'green'],
    ['Total Stok Fisik', stats.physical_total, 'seluruh lokasi', 'neutral'],
    ['Total Stok Tersedia', stats.physical_total, 'siap digunakan', 'green'],
    ['Low Stock', stats.low_stock, 'perlu perhatian', 'orange'],
    ['Out of Stock', stats.out_of_stock, 'stok habis', 'red'],
    ['Barang Masuk Hari Ini', stats.incoming_today, 'unit diterima', 'green'],
    ['Barang Keluar Hari Ini', stats.outgoing_today, 'unit ke produksi', 'blue'],
    ['Transaksi Hari Ini', stats.transactions_today, 'pergerakan tercatat', 'neutral']
  ];
  const stockData = {
    labels: inventory.map(item => item.name),
    available: inventory.map(item => Number(item.qty)),
    minimum: inventory.map(item => Number(item.minimum_stock)),
    colors: inventory.map(item => Number(item.qty) <= 0 ? '#d74747' : Number(item.qty) <= Number(item.minimum_stock) ? '#d98c27' : '#258463')
  };
  const lowRows = lowStock.map(item => `<tr><td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.sku)}</small></td><td>${escapeHtml(item.qty)} ${escapeHtml(item.uom)}</td><td>${escapeHtml(item.minimum_stock)} ${escapeHtml(item.uom)}</td><td class="text-danger">${Math.max(Number(item.minimum_stock) - Number(item.qty), 0)} ${escapeHtml(item.uom)}</td><td>${escapeHtml(item.locations || '-')}</td><td><a class="btn btn-small btn-success" href="/receivings?sku=${encodeURIComponent(item.sku)}">Barang Masuk</a></td></tr>`).join('');
  const recentRows = recent.map(item => `<tr><td>${escapeHtml(formatDate(item.created_at))}</td><td>${formatStatus(item.transaction_type)}</td><td><strong>${escapeHtml(item.product_name)}</strong><small>${escapeHtml(item.sku)}</small></td><td class="text-success">${Number(item.qty_in) ? `+${escapeHtml(item.qty_in)} ${escapeHtml(item.uom)}` : '-'}</td><td class="text-blue">${Number(item.qty_out) ? `-${escapeHtml(item.qty_out)} ${escapeHtml(item.uom)}` : '-'}</td><td>${escapeHtml(item.location_code || '-')}</td><td>${escapeHtml(item.party_name || '-')}</td><td>${escapeHtml(item.admin_name || '-')}</td></tr>`).join('');
  const activity = payload.activity_today || [];
  const activityTypes = ['Barang Masuk', 'Barang Keluar', 'Stock Opname', 'Adjustment'];
  const activityData = activityTypes.map(type => ({ type, count: Number(activity.find(row => row.type === type)?.count || 0) }));
  const content = `
    <div class="dashboard-heading"><div><p class="eyebrow">OPERASIONAL BAHAN BAKU</p><p class="subheading">${demoMode ? 'Mode demo lokal: perubahan hanya tersimpan selama server berjalan.' : 'Data stok terpusat dari Supabase PostgreSQL.'}</p></div><div class="quick-actions"><a class="btn btn-success" href="/receivings">+ Barang Masuk</a><a class="btn btn-primary" href="/issues">− Barang Keluar</a><a class="btn btn-secondary" href="/stock-opname">Stock Opname</a></div></div>
    <div class="kpi-grid">${kpis.map(([label, value, note, tone]) => `<div class="kpi-card kpi-${tone}"><div class="kpi-label">${label}</div><div class="kpi-value">${escapeHtml(value ?? 0)}</div><div class="kpi-meta">${note}</div></div>`).join('')}</div>
    <div class="dashboard-grid dashboard-charts">
      <section class="panel chart-panel chart-wide"><div class="panel-heading"><div><h3>Stok Tersedia vs Minimum Stock</h3><p>Seluruh bahan baku aktif</p></div></div><div class="chart-canvas stock-chart"><canvas id="stockChart"></canvas></div></section>
      <section class="panel chart-panel"><div class="panel-heading"><div><h3>Pergerakan Stok</h3><p>Barang masuk dan keluar harian</p></div><select id="movementPeriod"><option value="7d" ${period === '7d' ? 'selected' : ''}>7 hari</option><option value="30d" ${period === '30d' ? 'selected' : ''}>30 hari</option><option value="month" ${period === 'month' ? 'selected' : ''}>Bulan ini</option></select></div><div class="chart-canvas"><canvas id="movementChart"></canvas></div></section>
      <section class="panel chart-panel"><div class="panel-heading"><div><h3>Komposisi Stok per Kategori</h3><p>Jumlah berdasarkan stok fisik</p></div></div><div class="chart-canvas donut-canvas"><canvas id="categoryChart"></canvas></div><ul class="category-breakdown">${categories.map((item, index) => `<li><span><i class="category-swatch swatch-${index}"></i>${escapeHtml(item.category)}</span><strong>${escapeHtml(item.quantity)} <small>${categoryTotal ? Math.round(Number(item.quantity) / categoryTotal * 100) : 0}%</small></strong></li>`).join('')}</ul></section>
      <section class="panel chart-panel"><div class="panel-heading"><div><h3>Aktivitas Gudang Hari Ini</h3><p>Jumlah transaksi per proses</p></div></div><div class="chart-canvas"><canvas id="activityChart"></canvas></div></section>
    </div>
    <section class="panel table-panel dashboard-table"><div class="panel-heading"><div><h3>Low Stock Prioritas</h3><p>Bahan paling kritis berdasarkan minimum stock</p></div><a class="text-link" href="/inventory?status=LOW%20STOCK">Lihat Semua →</a></div><div class="table-wrap"><table><thead><tr><th>Bahan Baku</th><th>Stok tersedia</th><th>Minimum</th><th>Kekurangan</th><th>Lokasi</th><th></th></tr></thead><tbody>${lowRows || '<tr><td colspan="6" class="empty-state">Tidak ada bahan low stock</td></tr>'}</tbody></table></div></section>
    <section class="panel table-panel dashboard-table"><div class="panel-heading"><div><h3>Aktivitas Terbaru</h3><p>10 movement terakhir</p></div><a class="text-link" href="/stock-movement">Buka ledger →</a></div><div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Tipe</th><th>Bahan</th><th>Qty masuk</th><th>Qty keluar</th><th>Lokasi</th><th>Supplier / tujuan</th><th>Admin</th></tr></thead><tbody>${recentRows || '<tr><td colspan="8" class="empty-state">Belum ada transaksi</td></tr>'}</tbody></table></div></section>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
      const stockData=${safeJson(stockData)}, movementData=${safeJson(payload.movements || [])}, categoryData=${safeJson(categories)}, activityData=${safeJson(activityData)};
      const common={responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:8}}}};
      if(window.Chart){new Chart(document.getElementById('stockChart'),{type:'bar',data:{labels:stockData.labels,datasets:[{label:'Stok tersedia',data:stockData.available,backgroundColor:stockData.colors,borderRadius:4},{label:'Minimum stock',data:stockData.minimum,backgroundColor:'#d8dedb',borderRadius:4}]},options:{...common,indexAxis:'y',scales:{x:{beginAtZero:true},y:{grid:{display:false}}}}});new Chart(document.getElementById('movementChart'),{type:'line',data:{labels:movementData.map(row=>row.day),datasets:[{label:'Barang Masuk',data:movementData.map(row=>row.qty_in),borderColor:'#258463',tension:.3},{label:'Barang Keluar',data:movementData.map(row=>row.qty_out),borderColor:'#3478c5',tension:.3}]},options:{...common,scales:{y:{beginAtZero:true},x:{grid:{display:false}}}}});new Chart(document.getElementById('categoryChart'),{type:'doughnut',data:{labels:categoryData.map(row=>row.category),datasets:[{data:categoryData.map(row=>row.quantity),backgroundColor:['#258463','#72b493','#3478c5','#d98c27'],borderWidth:0}]},options:{...common,cutout:'66%'}});new Chart(document.getElementById('activityChart'),{type:'bar',data:{labels:activityData.map(row=>row.type),datasets:[{data:activityData.map(row=>row.count),backgroundColor:['#258463','#3478c5','#d98c27','#d74747'],borderRadius:4}]},options:{...common,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0}},x:{grid:{display:false}}}}});}
      document.getElementById('movementPeriod').addEventListener('change', event => {const url=new URL(location.href);url.searchParams.set('period',event.target.value);location.href=url;});
      setInterval(()=>location.reload(),15000);
    </script>`;
  return renderPage({ title: 'Dashboard', user, active: 'dashboard', content });
}

app.get('/api/dashboard', requireAuth, asyncRoute(async (req, res) => {
  const period = ['7d', '30d', 'month'].includes(req.query.period) ? req.query.period : '7d';
  res.json(await rpc('wms_dashboard_payload', { p_period: period }));
}));
app.get('/dashboard', requireAuth, asyncRoute(async (req, res) => {
  const period = ['7d', '30d', 'month'].includes(req.query.period) ? req.query.period : '7d';
  res.send(renderDashboard(await rpc('wms_dashboard_payload', { p_period: period }), req.session.user, period));
}));

async function fetchActiveProducts(search = '') {
  let query = supabase.from('products').select('id,sku,name,category_id,brand,uom,supplier_id,minimum_stock,maximum_stock,status,categories(name),suppliers(id,supplier_code,name,status)').eq('status', 'Active').order('name');
  const { data, error } = await query;
  if (error) throw error;
  if (!search) return data || [];
  const term = search.toLowerCase();
  return (data || []).filter(row => [row.sku, row.name, row.categories?.name, row.suppliers?.name, row.suppliers?.supplier_code].some(value => String(value || '').toLowerCase().includes(term)));
}

function getFixedUnit(sku, name, requested) {
  if (materialUnits.has(sku)) return materialUnits.get(sku);
  const byName = [...materialUnits.entries()].find(([key]) => ({
    'RM-KAIN-TOP': 'Kain Topper', 'RM-KAIN-BOT': 'Kain Bottom', 'RM-KAIN-SID': 'Kain Side', 'RM-COTTON': 'Cotton Sheet',
    'RM-BUSA-D17': 'Busa Density 17', 'RM-BUSA-D18': 'Busa D18', 'RM-BUSA-D25': 'Busa D25',
    'RM-KAWAT-18': 'Kawat diameter 1.8mm', 'RM-KAWAT-20': 'Kawat diameter 2.0mm', 'RM-KAWAT-22': 'Kawat diameter 2.2mm',
    'RM-BENANG-H': 'Benang Hitam', 'RM-BENANG-P': 'Benang Putih', 'RM-WEB-H': 'Pita Webbing Hitam', 'RM-WEB-N': 'Pita Webbing Navy'
  })[key] === name);
  if (byName) return materialUnits.get(byName[0]);
  if (!['Meter', 'Roll', 'Lembar', 'Kilogram'].includes(requested)) throw new Error('Satuan bahan harus Meter, Roll, Lembar, atau Kilogram.');
  return requested;
}

app.get('/products', requireAuth, asyncRoute(async (req, res) => {
  const [products, categories, suppliers] = await Promise.all([
    fetchActiveProducts(req.query.search || ''),
    getRows('categories', '*', query => query.order('name')),
    getRows('suppliers', 'id,supplier_code,name,status', query => query.eq('status', 'Active').order('name'))
  ]);
  const categoryOptions = categories.filter(row => ['Kain', 'Busa', 'Kawat', 'Aksesoris'].includes(row.name));
  const rows = products.map(product => `<tr><td>${escapeHtml(product.sku)}</td><td>${escapeHtml(product.name)}</td><td>${escapeHtml(product.categories?.name || '-')}</td><td>${escapeHtml(product.brand || '-')}</td><td>${escapeHtml(product.uom)}</td><td>${escapeHtml(product.suppliers?.name || '-')}</td><td>${escapeHtml(product.minimum_stock)}</td><td>${formatStatus(product.status)}</td><td><form method="POST" action="/products/${product.id}/status"><input type="hidden" name="status" value="Inactive"><button class="btn btn-small btn-secondary" type="submit">Nonaktifkan</button></form></td></tr>`).join('');
  const content = `<div class="card-grid"><section class="form-panel"><h3>Tambah Bahan Baku</h3><form method="POST" action="/products"><div class="form-grid"><div class="field"><label>Kode bahan</label><input name="sku" required></div><div class="field"><label>Nama bahan</label><input name="name" required></div><div class="field"><label>Kategori</label><select name="category_id" required>${categoryOptions.map(row => `<option value="${row.id}">${escapeHtml(row.name)}</option>`).join('')}</select></div><div class="field"><label>Brand</label><input name="brand"></div><div class="field"><label>Satuan</label><select name="uom"><option>Meter</option><option>Lembar</option><option>Kilogram</option><option>Roll</option></select></div><div class="field"><label>Supplier Utama</label><select name="supplier_id"><option value="">Belum dipilih</option>${suppliers.map(row => `<option value="${row.id}">${escapeHtml(row.supplier_code)} · ${escapeHtml(row.name)}</option>`).join('')}</select><a class="text-link" href="/suppliers">+ Tambah Supplier</a></div><div class="field"><label>Minimum Stock</label><input type="number" min="0" step="0.001" name="minimum_stock" value="10"></div></div><div class="form-actions"><button class="btn btn-success" type="submit">Simpan Bahan</button></div></form></section><section class="panel table-panel"><div class="panel-heading"><div><h3>Master Bahan Baku</h3><p>Supplier utama tersimpan sebagai relasi.</p></div><a class="text-link" href="/suppliers">Master Supplier →</a></div><form class="filter-row" method="GET"><div class="field"><label>Cari bahan/supplier</label><input name="search" value="${escapeHtml(req.query.search || '')}" placeholder="Kode, nama, supplier"></div><button class="btn btn-secondary">Cari</button></form><div class="table-wrap"><table><thead><tr><th>Kode</th><th>Nama bahan</th><th>Kategori</th><th>Brand</th><th>Satuan</th><th>Supplier utama</th><th>Minimum</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows || '<tr><td colspan="9" class="empty-state">Bahan baku tidak ditemukan</td></tr>'}</tbody></table></div></section></div>`;
  res.send(renderPage({ title: 'Master Bahan Baku', user: req.session.user, active: 'products', content }));
}));

app.post('/products', requireAuth, asyncRoute(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const sku = String(req.body.sku || '').trim().toUpperCase();
  const supplierId = req.body.supplier_id ? Number(req.body.supplier_id) : null;
  const uom = getFixedUnit(sku, name, req.body.uom);
  if (supplierId) {
    const { data: supplier, error } = await supabase.from('suppliers').select('id,status').eq('id', supplierId).maybeSingle();
    if (error) throw error;
    if (!supplier || supplier.status !== 'Active') return renderMessage(req, 'Supplier tidak valid', 'Pilih supplier yang masih Active.', 400, '/products');
  }
  const { error } = await supabase.from('products').insert({
    sku, name, category_id: Number(req.body.category_id), brand: req.body.brand || null, uom,
    supplier_id: supplierId, minimum_stock: Number(req.body.minimum_stock || 0), status: 'Active'
  });
  if (error) throw error;
  await addActivity(req.session.user.id, 'Create Product', `SKU-${sku}`, `${name} added`);
  res.redirect('/products');
}));

app.post('/products/:id/status', requireAuth, asyncRoute(async (req, res) => {
  const { error } = await supabase.from('products').update({ status: req.body.status === 'Active' ? 'Active' : 'Inactive', updated_at: new Date().toISOString() }).eq('id', req.params.id);
  if (error) throw error;
  await addActivity(req.session.user.id, 'Update Product Status', `SKU-${req.params.id}`, `Status ${req.body.status}`);
  res.redirect('/products');
}));

app.get('/suppliers', requireAuth, asyncRoute(async (req, res) => {
  const term = String(req.query.search || '').trim().toLowerCase();
  const all = await getRows('suppliers', '*', query => query.order('supplier_code'));
  const suppliers = term ? all.filter(row => [row.supplier_code, row.name, row.contact_name].some(value => String(value || '').toLowerCase().includes(term))) : all;
  const rows = suppliers.map(row => `<tr><td>${escapeHtml(row.supplier_code)}</td><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.contact_name || '-')}</td><td>${escapeHtml(row.phone || '-')}</td><td>${escapeHtml(row.email || '-')}</td><td>${escapeHtml(row.address || '-')}</td><td>${formatStatus(row.status)}</td><td>${escapeHtml(formatDate(row.created_at))}</td><td><a class="btn btn-small btn-secondary" href="/suppliers/${row.id}/edit">Edit</a> ${row.status === 'Active' ? `<form class="inline-form" method="POST" action="/suppliers/${row.id}/status"><input type="hidden" name="status" value="Inactive"><button class="btn btn-small btn-warning">Nonaktifkan</button></form>` : '-'}</td></tr>`).join('');
  const content = `<div class="card-grid"><section class="form-panel"><h3>Tambah Supplier</h3><form method="POST" action="/suppliers"><div class="form-grid"><div class="field"><label>Nama supplier</label><input name="name" required></div><div class="field"><label>Nama PIC</label><input name="contact_name" required></div><div class="field"><label>Nomor telepon</label><input name="phone"></div><div class="field"><label>Email</label><input type="email" name="email"></div><div class="field field-span"><label>Alamat</label><input name="address"></div></div><div class="form-actions"><button class="btn btn-success">Simpan Supplier</button></div></form></section><section class="panel table-panel"><div class="panel-heading"><div><h3>Master Supplier</h3><p>Kode supplier dibuat otomatis; riwayat transaksi tetap tersimpan.</p></div></div><form class="filter-row"><div class="field"><label>Cari kode, nama, atau PIC</label><input name="search" value="${escapeHtml(req.query.search || '')}"></div><button class="btn btn-secondary">Cari</button></form><div class="table-wrap"><table><thead><tr><th>Kode</th><th>Supplier</th><th>PIC</th><th>Telepon</th><th>Email</th><th>Alamat</th><th>Status</th><th>Dibuat</th><th>Aksi</th></tr></thead><tbody>${rows || '<tr><td colspan="9" class="empty-state">Supplier tidak ditemukan</td></tr>'}</tbody></table></div></section></div>`;
  res.send(renderPage({ title: 'Master Supplier', user: req.session.user, active: 'suppliers', content }));
}));

app.post('/suppliers', requireAuth, asyncRoute(async (req, res) => {
  const { error } = await supabase.from('suppliers').insert({
    name: String(req.body.name || '').trim(), contact_name: String(req.body.contact_name || '').trim(),
    phone: req.body.phone || null, email: req.body.email || null, address: req.body.address || null, status: 'Active'
  });
  if (error) throw error;
  await addActivity(req.session.user.id, 'Create Supplier', 'SUP', String(req.body.name || '').trim());
  res.redirect('/suppliers');
}));

app.get('/suppliers/:id/edit', requireAuth, asyncRoute(async (req, res) => {
  const { data: supplier, error } = await supabase.from('suppliers').select('*').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!supplier) return renderMessage(req, 'Supplier tidak ditemukan', 'Data supplier tidak ditemukan.', 404, '/suppliers');
  const content = `<section class="form-panel"><h3>Edit ${escapeHtml(supplier.supplier_code)}</h3><form method="POST" action="/suppliers/${supplier.id}/edit"><div class="form-grid"><div class="field"><label>Kode supplier</label><input value="${escapeHtml(supplier.supplier_code)}" disabled></div><div class="field"><label>Nama supplier</label><input name="name" value="${escapeHtml(supplier.name)}" required></div><div class="field"><label>Nama PIC</label><input name="contact_name" value="${escapeHtml(supplier.contact_name)}" required></div><div class="field"><label>Nomor telepon</label><input name="phone" value="${escapeHtml(supplier.phone)}"></div><div class="field"><label>Email</label><input type="email" name="email" value="${escapeHtml(supplier.email)}"></div><div class="field field-span"><label>Alamat</label><input name="address" value="${escapeHtml(supplier.address)}"></div></div><div class="form-actions"><a class="btn btn-secondary" href="/suppliers">Kembali</a><button class="btn btn-primary">Simpan Perubahan</button></div></form></section>`;
  res.send(renderPage({ title: 'Edit Supplier', user: req.session.user, active: 'suppliers', content }));
}));

app.post('/suppliers/:id/edit', requireAuth, asyncRoute(async (req, res) => {
  const { error } = await supabase.from('suppliers').update({
    name: String(req.body.name || '').trim(), contact_name: String(req.body.contact_name || '').trim(),
    phone: req.body.phone || null, email: req.body.email || null, address: req.body.address || null, updated_at: new Date().toISOString()
  }).eq('id', req.params.id);
  if (error) throw error;
  await addActivity(req.session.user.id, 'Update Supplier', req.params.id, String(req.body.name || ''));
  res.redirect('/suppliers');
}));

app.post('/suppliers/:id/status', requireAuth, asyncRoute(async (req, res) => {
  const status = req.body.status === 'Active' ? 'Active' : 'Inactive';
  const { error } = await supabase.from('suppliers').update({ status, updated_at: new Date().toISOString() }).eq('id', req.params.id);
  if (error) throw error;
  await addActivity(req.session.user.id, 'Update Supplier Status', req.params.id, status);
  res.redirect('/suppliers');
}));

app.get('/receivings', requireAuth, asyncRoute(async (req, res) => {
  const [suppliers, products, rows, locations] = await Promise.all([
    getRows('suppliers', 'id,supplier_code,name,status', query => query.eq('status', 'Active').order('name')),
    fetchActiveProducts(''),
    rpc('wms_receiving_rows', { p_search: req.query.search || null }),
    getRows('locations', 'id,location_code,warehouse_id,warehouses(code)', query => query.neq('status', 'Blocked'))
  ]);
  const selectedSku = String(req.query.sku || '');
  const productOptions = products.map(product => `<option value="${product.id}" data-supplier-id="${product.supplier_id || ''}" ${product.sku === selectedSku ? 'selected' : ''}>${escapeHtml(product.sku)} · ${escapeHtml(product.name)} · ${escapeHtml(product.uom)}</option>`).join('');
  const supplierOptions = suppliers.map(row => `<option value="${row.id}">${escapeHtml(row.supplier_code)} · ${escapeHtml(row.name)}</option>`).join('');
  const locationOptions = locations.map(location => `<option value="${location.id}">${escapeHtml(location.warehouses?.code)} · ${escapeHtml(location.location_code)}</option>`).join('');
  const tableRows = rows.map(row => `<tr><td><strong>${escapeHtml(row.po_number)}</strong><small>${escapeHtml(row.supplier_code)} · ${escapeHtml(row.supplier_name)} · ${escapeHtml(formatDate(row.arrival_date))}</small></td><td>${escapeHtml(row.sku)} · ${escapeHtml(row.product_name)}</td><td>${escapeHtml(row.received_qty)} ${escapeHtml(row.uom)}</td><td>${escapeHtml(row.accepted_qty || 0)} ${escapeHtml(row.uom)}</td><td class="text-danger">${escapeHtml(row.rejected_qty || 0)} ${escapeHtml(row.uom)}</td><td>${row.status === 'Pending' ? `<form class="inline-form" method="POST" action="/receivings/items/${row.item_id}/preview"><input type="number" name="accepted_qty" min="0" step="0.001" max="${row.received_qty}" placeholder="Accepted" required><input type="number" name="rejected_qty" min="0" step="0.001" max="${row.received_qty}" value="0" required><select name="location_id" required><option value="">Lokasi put away</option>${locationOptions}</select><input type="hidden" name="notes" value=""><button class="btn btn-small btn-success">Review Put Away</button></form>` : `${formatStatus(row.inspection_result || row.status)}<small>${escapeHtml(row.condition || '-')}</small>`}</td></tr>`).join('');
  const content = `<div class="workflow-steps"><span class="step-current">1 Receiving</span><span>2 Inspection</span><span>3 Put Away</span><span>4 Stok diperbarui</span></div><div class="card-grid"><section class="form-panel"><h3>Catat Barang Masuk</h3><p class="inline-note">Stok bertambah hanya setelah layar konfirmasi put-away.</p><form method="POST" action="/receivings"><div class="form-grid"><div class="field"><label>Nomor surat jalan / PO</label><input name="po_number" required></div><div class="field"><label>Supplier pengirim</label><select name="supplier_id" id="receivingSupplier" required><option value="">Pilih supplier aktif</option>${supplierOptions}</select></div><div class="field"><label>Tanggal penerimaan</label><input type="date" name="arrival_date" value="${new Date().toISOString().slice(0, 10)}" required></div><div class="field"><label>Bahan baku</label><select name="product_id" id="receivingProduct" required>${productOptions}</select></div><div class="field"><label>Jumlah diterima</label><input type="number" min="0.001" step="0.001" name="received_qty" required></div><div class="field"><label>Satuan</label><span class="field-hint">Mengikuti master bahan baku</span></div><div class="field"><label>Kondisi awal</label><select name="condition"><option>Baik</option><option>Perlu pemeriksaan</option><option>Rusak</option></select></div><div class="field"><label>Catatan</label><input name="notes"></div></div><div class="form-actions"><button class="btn btn-success">Simpan Penerimaan</button><a class="text-link" href="/suppliers">+ Tambah Supplier</a></div></form></section><section class="panel"><h3>Alur Barang Masuk</h3><ol class="workflow-list"><li><strong>Receiving</strong><span>Supplier harus aktif; supplier utama bahan terpilih otomatis.</span></li><li><strong>Inspection</strong><span>Jumlah accepted dan rejected harus sesuai jumlah diterima.</span></li><li><strong>Put Away</strong><span>Konfirmasi menambah stok melalui transaksi PostgreSQL atomik.</span></li></ol></section></div><section class="panel table-panel dashboard-table"><div class="panel-heading"><div><h3>Receiving & Inspeksi</h3><p>Supplier inactive tetap ditampilkan pada histori.</p></div></div><form class="filter-row"><div class="field"><label>Cari referensi, bahan, supplier</label><input name="search" value="${escapeHtml(req.query.search || '')}"></div><button class="btn btn-secondary">Cari</button></form><div class="table-wrap"><table><thead><tr><th>Referensi / Supplier</th><th>Bahan</th><th>Diterima</th><th>Accepted</th><th>Rejected</th><th>Status / Put Away</th></tr></thead><tbody>${tableRows || '<tr><td colspan="6" class="empty-state">Belum ada penerimaan</td></tr>'}</tbody></table></div></section>`;
  res.send(renderPage({ title: 'Barang Masuk', user: req.session.user, active: 'receivings', content }));
}));

app.post('/receivings', requireAuth, asyncRoute(async (req, res) => {
  const result = await rpc('wms_create_receiving', {
    p_po_number: String(req.body.po_number || '').trim(), p_supplier_id: Number(req.body.supplier_id),
    p_arrival_date: req.body.arrival_date, p_product_id: Number(req.body.product_id),
    p_received_qty: Number(req.body.received_qty), p_condition: req.body.condition || null,
    p_notes: req.body.notes || null, p_user_id: req.session.user.id
  });
  res.redirect('/receivings?created=1&reference=' + encodeURIComponent(result.receiving_code));
}));

app.post('/receivings/items/:id/preview', requireAuth, asyncRoute(async (req, res) => {
  const rows = await rpc('wms_receiving_rows', { p_search: null });
  const item = rows.find(row => Number(row.item_id) === Number(req.params.id) && row.status === 'Pending');
  const acceptedQty = Number(req.body.accepted_qty);
  const rejectedQty = Number(req.body.rejected_qty);
  if (!item || !Number.isFinite(acceptedQty) || !Number.isFinite(rejectedQty) || acceptedQty < 0 || rejectedQty < 0 || Math.abs(acceptedQty + rejectedQty - Number(item.received_qty)) > 0.000001) {
    return renderMessage(req, 'Pemeriksaan tidak valid', 'Jumlah accepted dan rejected harus sama dengan jumlah penerimaan.', 400, '/receivings');
  }
  const locationId = Number(req.body.location_id);
  const { data: location, error } = await supabase.from('locations').select('id,location_code,warehouse_id,warehouses(code)').eq('id', locationId).maybeSingle();
  if (error) throw error;
  if (!location) return renderMessage(req, 'Lokasi tidak ditemukan', 'Pilih lokasi yang valid.', 400, '/receivings');
  const { data: stock, error: stockError } = await supabase.from('inventory').select('physical_qty').eq('product_id', item.product_id).eq('location_id', locationId).maybeSingle();
  if (stockError) throw stockError;
  const before = Number(stock?.physical_qty || 0);
  const after = before + acceptedQty;
  const result = acceptedQty === 0 ? 'Ditolak' : rejectedQty === 0 ? 'Diterima' : 'Sebagian Diterima';
  const content = `<div class="workflow-steps"><span>1 Receiving</span><span>2 Inspection</span><span class="step-current">3 Konfirmasi Put Away</span></div><section class="panel"><h3>Konfirmasi Barang Masuk</h3><p class="inline-note">Stok belum berubah. Perubahan hanya dilakukan setelah konfirmasi berikut.</p><div class="table-wrap"><table><tbody><tr><th>Nomor PO / surat jalan</th><td>${escapeHtml(item.po_number)}</td></tr><tr><th>Supplier</th><td>${escapeHtml(item.supplier_code)} · ${escapeHtml(item.supplier_name)}</td></tr><tr><th>Bahan baku</th><td>${escapeHtml(item.sku)} · ${escapeHtml(item.product_name)}</td></tr><tr><th>Hasil QC</th><td>${escapeHtml(result)}</td></tr><tr><th>Jumlah accepted</th><td>${acceptedQty} ${escapeHtml(item.uom)}</td></tr><tr><th>Jumlah rejected / karantina</th><td>${rejectedQty} ${escapeHtml(item.uom)}</td></tr><tr><th>Lokasi penyimpanan</th><td>${escapeHtml(location.warehouses?.code)} · ${escapeHtml(location.location_code)}</td></tr><tr><th>Stok sebelum</th><td>${before} ${escapeHtml(item.uom)}</td></tr><tr><th>Stok setelah</th><td>${after} ${escapeHtml(item.uom)}</td></tr><tr><th>Catatan</th><td>${escapeHtml(req.body.notes || '-')}</td></tr></tbody></table></div><form method="POST" action="/receivings/items/${item.item_id}/complete"><input type="hidden" name="accepted_qty" value="${acceptedQty}"><input type="hidden" name="rejected_qty" value="${rejectedQty}"><input type="hidden" name="location_id" value="${locationId}"><input type="hidden" name="notes" value="${escapeHtml(req.body.notes || '')}"><div class="form-actions"><a class="btn btn-secondary" href="/receivings">Kembali</a><button class="btn btn-success">Konfirmasi & Tambah Stok</button></div></form></section>`;
  res.send(renderPage({ title: 'Konfirmasi Barang Masuk', user: req.session.user, active: 'receivings', content }));
}));

app.post('/receivings/items/:id/complete', requireAuth, asyncRoute(async (req, res) => {
  await rpc('wms_complete_putaway', {
    p_receiving_item_id: Number(req.params.id), p_accepted_qty: Number(req.body.accepted_qty),
    p_rejected_qty: Number(req.body.rejected_qty), p_location_id: Number(req.body.location_id),
    p_user_id: req.session.user.id, p_notes: req.body.notes || null
  });
  broadcastStockChange();
  res.redirect('/receivings');
}));

app.get('/issues', requireAuth, asyncRoute(async (req, res) => {
  const search = req.query.search || '';
  const [inventory, history] = await Promise.all([
    rpc('wms_issue_options', { p_search: search || null }),
    rpc('wms_issue_history', { p_search: search || null })
  ]);
  const options = inventory.map(row => `<option value="${row.inventory_id}" ${req.query.sku === row.sku ? 'selected' : ''}>${escapeHtml(row.sku)} · ${escapeHtml(row.product_name)} · ${escapeHtml(row.warehouse_code)} / ${escapeHtml(row.location_code)} · tersedia ${escapeHtml(row.physical_qty)} ${escapeHtml(row.uom)}</option>`).join('');
  const rows = history.map(row => `<tr><td>${escapeHtml(formatDate(row.created_at))}<small>${escapeHtml(row.reference_id)}</small></td><td>${escapeHtml(row.sku)} · ${escapeHtml(row.product_name)}</td><td class="text-blue">-${escapeHtml(row.qty_out)} ${escapeHtml(row.uom)}</td><td>${escapeHtml(row.location_code)}</td><td>${escapeHtml(row.party_name || '-')}</td><td>${escapeHtml(row.recipient_name || '-')}</td><td>${escapeHtml(row.admin_name || '-')}</td></tr>`).join('');
  const content = `<div class="workflow-steps"><span class="step-current step-blue">1 Barang Keluar</span><span>2 Validasi Stok</span><span>3 Issue to Production</span><span>4 Stok diperbarui</span></div><div class="card-grid"><section class="form-panel"><h3>Pengeluaran ke Produksi</h3><p class="inline-note">Saldo final divalidasi ulang dan dikunci oleh PostgreSQL.</p><form method="POST" action="/issues/preview"><div class="form-grid"><div class="field"><label>Bahan & lokasi</label><select name="inventory_id" required>${options}</select></div><div class="field"><label>Jumlah keluar</label><input type="number" name="qty" min="0.001" step="0.001" required></div><div class="field"><label>Tujuan / proses produksi</label><input name="purpose" required></div><div class="field"><label>Penerima produksi</label><input name="recipient" required></div><div class="field field-span"><label>Catatan</label><input name="notes"></div></div><div class="form-actions"><button class="btn btn-primary">Review Pengeluaran</button></div></form></section><section class="panel"><h3>Validasi Otomatis</h3><ul class="workflow-list"><li><strong>Stok tersedia</strong><span>Diambil per lokasi penyimpanan.</span></li><li><strong>Saldo cukup</strong><span>RPC mengunci baris agar transaksi bersamaan tidak menyebabkan stok negatif.</span></li></ul></section></div><section class="panel table-panel dashboard-table"><div class="panel-heading"><div><h3>Riwayat Issue Produksi</h3><p>Pengeluaran bahan baku terbaru</p></div></div><form class="filter-row"><div class="field"><label>Cari bahan, lokasi, referensi, tujuan, admin</label><input name="search" value="${escapeHtml(search)}"></div><button class="btn btn-secondary">Cari</button></form><div class="table-wrap"><table><thead><tr><th>Waktu / Referensi</th><th>Bahan</th><th>Qty keluar</th><th>Lokasi</th><th>Tujuan</th><th>Penerima</th><th>Admin</th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="empty-state">Belum ada issue produksi</td></tr>'}</tbody></table></div></section>`;
  res.send(renderPage({ title: 'Barang Keluar', user: req.session.user, active: 'issues', content }));
}));

app.post('/issues/preview', requireAuth, asyncRoute(async (req, res) => {
  const inventoryId = Number(req.body.inventory_id);
  const qty = Number(req.body.qty);
  if (!Number.isFinite(qty) || qty <= 0) return renderMessage(req, 'Jumlah tidak valid', 'Jumlah keluar harus lebih dari nol.', 400, '/issues');
  if (!String(req.body.purpose || '').trim() || !String(req.body.recipient || '').trim()) {
    return renderMessage(req, 'Data produksi belum lengkap', 'Tujuan produksi dan nama penerima wajib diisi.', 400, '/issues');
  }
  const { data: stock, error } = await supabase.from('inventory').select('id,product_id,warehouse_id,location_id,physical_qty,products(sku,name,uom),locations(location_code,warehouses(code))').eq('id', inventoryId).maybeSingle();
  if (error) throw error;
  if (!stock) return renderMessage(req, 'Stok tidak ditemukan', 'Pilih baris stok yang valid.', 400, '/issues');
  const before = Number(stock.physical_qty);
  const after = before - qty;
  if (after < 0) return renderMessage(req, 'Stok tidak mencukupi', `Tersedia ${before} ${stock.products.uom}; transaksi diblokir.`, 400, '/issues');
  const content = `<section class="panel"><h3>Konfirmasi Barang Keluar</h3><p class="inline-note">Stok belum berubah. PostgreSQL memvalidasi ulang saat konfirmasi.</p><div class="table-wrap"><table><tbody><tr><th>Bahan baku</th><td>${escapeHtml(stock.products.sku)} · ${escapeHtml(stock.products.name)}</td></tr><tr><th>Lokasi pengambilan</th><td>${escapeHtml(stock.locations.warehouses?.code)} · ${escapeHtml(stock.locations.location_code)}</td></tr><tr><th>Jumlah keluar</th><td>${qty} ${escapeHtml(stock.products.uom)}</td></tr><tr><th>Stok sebelum</th><td>${before} ${escapeHtml(stock.products.uom)}</td></tr><tr><th>Stok setelah</th><td>${after} ${escapeHtml(stock.products.uom)}</td></tr><tr><th>Tujuan / proses produksi</th><td>${escapeHtml(req.body.purpose)}</td></tr><tr><th>Nama penerima</th><td>${escapeHtml(req.body.recipient)}</td></tr><tr><th>Catatan</th><td>${escapeHtml(req.body.notes || '-')}</td></tr></tbody></table></div><form method="POST" action="/issues"><input type="hidden" name="inventory_id" value="${inventoryId}"><input type="hidden" name="qty" value="${qty}"><input type="hidden" name="purpose" value="${escapeHtml(req.body.purpose)}"><input type="hidden" name="recipient" value="${escapeHtml(req.body.recipient)}"><input type="hidden" name="notes" value="${escapeHtml(req.body.notes || '')}"><div class="form-actions"><a class="btn btn-secondary" href="/issues">Kembali</a><button class="btn btn-primary">Konfirmasi Barang Keluar</button></div></form></section>`;
  res.send(renderPage({ title: 'Konfirmasi Barang Keluar', user: req.session.user, active: 'issues', content }));
}));

app.post('/issues', requireAuth, asyncRoute(async (req, res) => {
  await rpc('wms_issue_to_production', {
    p_inventory_id: Number(req.body.inventory_id), p_qty: Number(req.body.qty),
    p_purpose: String(req.body.purpose || '').trim(), p_recipient: String(req.body.recipient || '').trim(),
    p_notes: req.body.notes || null, p_user_id: req.session.user.id
  });
  broadcastStockChange();
  res.redirect('/issues');
}));

app.get('/inventory', requireAuth, asyncRoute(async (req, res) => {
  const [rows, categories, locations] = await Promise.all([
    rpc('wms_inventory_rows', { p_search: req.query.search || null, p_category: req.query.category || null, p_location: req.query.location || null, p_status: req.query.status || null }),
    getRows('categories', 'id,name', query => query.order('name')),
    getRows('locations', 'id,location_code', query => query.order('location_code'))
  ]);
  const categoriesActive = categories.filter(item => ['Kain', 'Busa', 'Kawat', 'Aksesoris'].includes(item.name));
  const htmlRows = rows.map(row => `<tr><td>${escapeHtml(row.sku)}</td><td>${escapeHtml(row.product_name)}</td><td>${escapeHtml(row.category || '-')}</td><td>${escapeHtml(row.uom)}</td><td>${escapeHtml(row.warehouse_code || '-')}</td><td>${escapeHtml(row.location_code || '-')}</td><td>${escapeHtml(row.physical_qty)}${row.status === 'QUARANTINE' ? `<small class="text-danger">Karantina ${escapeHtml(row.quarantine_qty)} ${escapeHtml(row.uom)}</small>` : ''}</td><td>${escapeHtml(row.available_qty)}</td><td>${escapeHtml(row.minimum_stock)}</td><td>${formatStatus(row.status)}</td><td><a class="btn btn-small btn-success" href="/receivings?sku=${encodeURIComponent(row.sku)}">Masuk</a> <a class="btn btn-small btn-primary" href="/issues?sku=${encodeURIComponent(row.sku)}">Keluar</a></td></tr>`).join('');
  const content = `<section class="panel table-panel"><div class="panel-heading"><div><h3>Stok Gudang</h3><p>Data terpusat; available quantity sama dengan physical quantity.</p></div><div><a class="btn btn-small btn-success" href="/exports/inventory.csv">Export CSV</a> <a class="btn btn-small btn-secondary" href="/adjustments">Adjustment</a></div></div><form class="filter-row"><div class="field"><label>Cari kode/nama bahan</label><input name="search" value="${escapeHtml(req.query.search || '')}"></div><div class="field"><label>Kategori</label><select name="category"><option value="">Semua</option>${categoriesActive.map(row => `<option ${req.query.category === row.name ? 'selected' : ''}>${escapeHtml(row.name)}</option>`).join('')}</select></div><div class="field"><label>Lokasi</label><select name="location"><option value="">Semua</option>${locations.map(row => `<option ${req.query.location === row.location_code ? 'selected' : ''}>${escapeHtml(row.location_code)}</option>`).join('')}</select></div><div class="field"><label>Status</label><select name="status"><option value="">Semua</option>${['NORMAL','LOW STOCK','OUT OF STOCK','QUARANTINE'].map(status => `<option ${req.query.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></div><button class="btn btn-secondary">Filter</button></form><div class="table-wrap"><table><thead><tr><th>Kode bahan</th><th>Nama bahan</th><th>Kategori</th><th>Satuan</th><th>Warehouse</th><th>Lokasi</th><th>Stok fisik</th><th>Stok tersedia</th><th>Minimum</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${htmlRows || '<tr><td colspan="11" class="empty-state">Tidak ada stok sesuai filter</td></tr>'}</tbody></table></div></section>`;
  res.send(renderPage({ title: 'Stok Gudang', user: req.session.user, active: 'inventory', content }));
}));

app.get('/stock-movement', requireAuth, asyncRoute(async (req, res) => {
  const [rows, products, locations] = await Promise.all([
    rpc('wms_movement_rows', getMovementParams(req.query)),
    fetchActiveProducts(''),
    getRows('locations', 'location_code', query => query.order('location_code'))
  ]);
  const htmlRows = rows.map(row => `<tr><td>${escapeHtml(formatDate(row.created_at))}</td><td>${escapeHtml(row.reference_id || '-')}</td><td>${formatStatus(row.transaction_type)}</td><td>${escapeHtml(row.sku || '-')}</td><td>${escapeHtml(row.product_name || '-')}</td><td>${escapeHtml(row.location_code || '-')}</td><td class="text-success">${Number(row.qty_in) ? `+${escapeHtml(row.qty_in)} ${escapeHtml(row.uom)}` : '-'}</td><td class="text-blue">${Number(row.qty_out) ? `-${escapeHtml(row.qty_out)} ${escapeHtml(row.uom)}` : '-'}</td><td>${escapeHtml(row.balance)} ${escapeHtml(row.uom || '')}</td><td>${escapeHtml(row.party_name || '-')} ${row.recipient_name ? `<small>${escapeHtml(row.recipient_name)}</small>` : ''}</td><td>${escapeHtml(row.notes || '-')}</td><td>${escapeHtml(row.admin_name || '-')}</td></tr>`).join('');
  const query = new URLSearchParams(Object.entries(req.query).filter(([, value]) => value));
  const content = `<section class="panel table-panel"><div class="panel-heading"><div><h3>Stock Movement</h3><p>Ledger transaksi immutable untuk semua perangkat.</p></div><a class="btn btn-small btn-success" href="/exports/movement.csv?${query}">Export CSV aktif</a></div><form class="filter-row"><div class="field"><label>Cari referensi/supplier/tujuan</label><input name="search" value="${escapeHtml(req.query.search || '')}"></div><div class="field"><label>Dari</label><input type="date" name="from" value="${escapeHtml(req.query.from || '')}"></div><div class="field"><label>Sampai</label><input type="date" name="to" value="${escapeHtml(req.query.to || '')}"></div><div class="field"><label>Tipe</label><select name="type"><option value="">Semua</option>${['Barang Masuk / Put Away','Barang Keluar / Issue to Production','Stock Opname','Adjustment','Quarantine'].map(type => `<option value="${type}" ${req.query.type === type ? 'selected' : ''}>${type}</option>`).join('')}</select></div><div class="field"><label>Bahan</label><select name="product"><option value="">Semua</option>${products.map(row => `<option value="${escapeHtml(row.sku)}" ${req.query.product === row.sku ? 'selected' : ''}>${escapeHtml(row.sku)} · ${escapeHtml(row.name)}</option>`).join('')}</select></div><div class="field"><label>Lokasi</label><select name="location"><option value="">Semua</option>${locations.map(row => `<option ${req.query.location === row.location_code ? 'selected' : ''}>${escapeHtml(row.location_code)}</option>`).join('')}</select></div><div class="field"><label>Admin</label><input name="admin" value="${escapeHtml(req.query.admin || '')}"></div><button class="btn btn-secondary">Filter</button></form><div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Referensi</th><th>Tipe</th><th>Kode bahan</th><th>Nama bahan</th><th>Lokasi</th><th>Qty masuk</th><th>Qty keluar</th><th>Stok akhir</th><th>Supplier/tujuan</th><th>Catatan</th><th>Admin</th></tr></thead><tbody>${htmlRows || '<tr><td colspan="12" class="empty-state">Tidak ada movement yang cocok</td></tr>'}</tbody></table></div></section>`;
  res.send(renderPage({ title: 'Stock Movement', user: req.session.user, active: 'stock-movement', content }));
}));

app.get('/stock-opname', requireAuth, asyncRoute(async (req, res) => {
  const [products, locations, opnames] = await Promise.all([
    fetchActiveProducts(''), getRows('locations', 'id,location_code,warehouse_id,warehouses(code)', query => query.order('location_code')),
    rpc('wms_opname_rows')
  ]);
  const htmlRows = opnames.map(row => `<tr><td>${escapeHtml(row.opname_code)}<small>${escapeHtml(formatDate(row.created_at))}</small></td><td>${escapeHtml(row.sku)} · ${escapeHtml(row.product_name)}</td><td>${escapeHtml(row.location_code)}</td><td>${escapeHtml(row.system_qty)} ${escapeHtml(row.uom)}</td><td>${escapeHtml(row.physical_qty)} ${escapeHtml(row.uom)}</td><td class="${Number(row.variance) ? 'text-danger' : 'text-success'}">${Number(row.variance) > 0 ? '+' : ''}${escapeHtml(row.variance)}</td><td>${escapeHtml(row.reason || '-')}</td><td>${escapeHtml(row.admin_name || '-')}</td></tr>`).join('');
  const content = `<div class="card-grid"><section class="form-panel"><h3>Input Hasil Stock Opname</h3><form method="POST" action="/stock-opname"><div class="form-grid"><div class="field"><label>Bahan baku</label><select name="product_id">${products.map(row => `<option value="${row.id}">${escapeHtml(row.sku)} · ${escapeHtml(row.name)}</option>`).join('')}</select></div><div class="field"><label>Lokasi</label><select name="location_id">${locations.map(row => `<option value="${row.id}">${escapeHtml(row.warehouses?.code)} · ${escapeHtml(row.location_code)}</option>`).join('')}</select></div><div class="field"><label>Stok fisik aktual</label><input name="physical_qty" type="number" min="0" step="0.001" required></div><div class="field field-span"><label>Alasan selisih</label><input name="reason" placeholder="Wajib jika berbeda dari sistem"></div></div><div class="form-actions"><button class="btn btn-secondary">Simpan Hasil Opname</button><a class="btn btn-primary" href="/adjustments">Adjustment langsung</a></div></form></section><section class="panel"><h3>Validasi opname</h3><p>Saldo sistem dikunci di PostgreSQL, selisih dihitung di server, lalu satu transaksi Stock Opname dibuat.</p></section></div><section class="panel table-panel"><div class="table-wrap"><table><thead><tr><th>Referensi / waktu</th><th>Bahan</th><th>Lokasi</th><th>Sistem</th><th>Fisik</th><th>Selisih</th><th>Alasan</th><th>Admin</th></tr></thead><tbody>${htmlRows || '<tr><td colspan="8" class="empty-state">Belum ada stock opname</td></tr>'}</tbody></table></div></section>`;
  res.send(renderPage({ title: 'Stock Opname', user: req.session.user, active: 'stock-opname', content }));
}));

app.post('/stock-opname', requireAuth, asyncRoute(async (req, res) => {
  await rpc('wms_stock_opname', {
    p_product_id: Number(req.body.product_id), p_location_id: Number(req.body.location_id),
    p_physical_qty: Number(req.body.physical_qty), p_reason: String(req.body.reason || '').trim() || null,
    p_user_id: req.session.user.id
  });
  broadcastStockChange();
  res.redirect('/stock-opname');
}));

app.get('/adjustments', requireAuth, asyncRoute(async (req, res) => {
  const [products, locations, adjustments] = await Promise.all([
    fetchActiveProducts(''), getRows('locations', 'id,location_code,warehouses(code)', query => query.order('location_code')),
    getRows('stock_adjustments', '*', query => query.order('id', { ascending: false }).limit(100))
  ]);
  const rows = adjustments.map(row => `<tr><td>${escapeHtml(row.adjustment_code)}</td><td>${escapeHtml(row.sku)}</td><td>${escapeHtml(row.location_id)}</td><td>${escapeHtml(row.adjustment_qty)}</td><td>${escapeHtml(row.reason)}</td><td>${formatStatus(row.status)}</td></tr>`).join('');
  const content = `<div class="card-grid"><section class="form-panel"><h3>Adjustment Stok</h3><p class="inline-note">Adjustment beralasan diproses atomik tanpa approval berlapis.</p><form method="POST"><div class="form-grid"><div class="field"><label>Bahan baku</label><select name="product_id">${products.map(row => `<option value="${row.id}">${escapeHtml(row.sku)} · ${escapeHtml(row.name)}</option>`).join('')}</select></div><div class="field"><label>Lokasi</label><select name="location_id">${locations.map(row => `<option value="${row.id}">${escapeHtml(row.warehouses?.code)} · ${escapeHtml(row.location_code)}</option>`).join('')}</select></div><div class="field"><label>Adjustment (+/-)</label><input type="number" step="0.001" name="adjustment_qty" required></div><div class="field"><label>Alasan</label><input name="reason" required></div></div><div class="form-actions"><a class="btn btn-secondary" href="/inventory">Kembali</a><button class="btn btn-primary">Konfirmasi Adjustment</button></div></form></section><section class="panel table-panel"><h3>Riwayat Adjustment</h3><div class="table-wrap"><table><thead><tr><th>Referensi</th><th>SKU</th><th>Lokasi ID</th><th>Qty</th><th>Alasan</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="empty-state">Belum ada adjustment</td></tr>'}</tbody></table></div></section></div>`;
  res.send(renderPage({ title: 'Adjustment', user: req.session.user, active: '', content }));
}));

app.post('/adjustments', requireAuth, asyncRoute(async (req, res) => {
  await rpc('wms_adjust_stock', {
    p_product_id: Number(req.body.product_id), p_location_id: Number(req.body.location_id),
    p_adjustment_qty: Number(req.body.adjustment_qty), p_reason: String(req.body.reason || '').trim(), p_user_id: req.session.user.id
  });
  broadcastStockChange();
  res.redirect('/adjustments');
}));

app.get('/reports', requireAuth, asyncRoute(async (req, res) => {
  const report = await rpc('wms_report_payload');
  const inventoryRows = (report.inventory || []).map(row => `<tr><td>${escapeHtml(row.sku)}</td><td>${escapeHtml(row.product_name)}</td><td>${escapeHtml(row.category || '-')}</td><td>${escapeHtml(row.physical_qty)} ${escapeHtml(row.uom)}</td><td>${escapeHtml(row.minimum_stock)} ${escapeHtml(row.uom)}</td><td>${formatStatus(row.status)}</td></tr>`).join('');
  const inboundRows = (report.inbound || []).map(row => `<tr><td>${escapeHtml(row.supplier_name || '-')}</td><td>${escapeHtml(row.receiving_count)}</td><td>${escapeHtml(row.quantity)} ${escapeHtml(row.uom)}</td></tr>`).join('');
  const outboundRows = (report.outbound || []).map(row => `<tr><td>${escapeHtml(row.purpose || '-')}</td><td>${escapeHtml(row.recipient || '-')}</td><td>${escapeHtml(row.transaction_count)}</td><td>${escapeHtml(row.total_qty)} ${escapeHtml(row.uom)}</td></tr>`).join('');
  const opnameRows = (report.opnames || []).map(row => `<tr><td>${escapeHtml(formatDate(row.created_at))}</td><td>${escapeHtml(row.sku)} · ${escapeHtml(row.name)}</td><td>${escapeHtml(row.system_qty)} ${escapeHtml(row.uom)}</td><td>${escapeHtml(row.physical_qty)} ${escapeHtml(row.uom)}</td><td>${escapeHtml(row.variance)} ${escapeHtml(row.uom)}</td><td>${escapeHtml(row.reason)}</td><td>${escapeHtml(row.admin_name || '-')}</td></tr>`).join('');
  const movementRows = (report.movement || []).map(row => `<tr><td>${escapeHtml(row.transaction_type)}</td><td>${escapeHtml(row.count)}</td><td>${escapeHtml(row.total_in)}</td><td>${escapeHtml(row.total_out)}</td></tr>`).join('');
  const content = `<div class="dashboard-grid"><section class="panel table-panel chart-wide"><div class="panel-heading"><h3>Laporan Stok Bahan Baku</h3><a class="btn btn-small btn-success" href="/exports/inventory.csv">Export CSV</a></div><div class="table-wrap"><table><thead><tr><th>Kode</th><th>Bahan</th><th>Kategori</th><th>Stok fisik</th><th>Minimum</th><th>Status</th></tr></thead><tbody>${inventoryRows}</tbody></table></div></section><section class="panel table-panel"><div class="panel-heading"><h3>Barang Masuk</h3><a class="btn btn-small btn-success" href="/exports/inbound.csv?from=${escapeHtml(req.query.from || '')}&to=${escapeHtml(req.query.to || '')}">Export CSV</a></div><form class="filter-row"><input type="date" name="from" value="${escapeHtml(req.query.from || '')}"><input type="date" name="to" value="${escapeHtml(req.query.to || '')}"><button class="btn btn-small btn-secondary">Periode</button></form><div class="table-wrap"><table><thead><tr><th>Supplier</th><th>Transaksi</th><th>Qty masuk</th></tr></thead><tbody>${inboundRows}</tbody></table></div></section><section class="panel table-panel"><div class="panel-heading"><h3>Issue ke Produksi</h3><a class="btn btn-small btn-primary" href="/exports/outbound.csv?from=${escapeHtml(req.query.from || '')}&to=${escapeHtml(req.query.to || '')}">Export CSV</a></div><div class="table-wrap"><table><thead><tr><th>Tujuan</th><th>Penerima</th><th>Transaksi</th><th>Qty keluar</th></tr></thead><tbody>${outboundRows}</tbody></table></div></section><section class="panel table-panel chart-wide"><h3>Stock Opname</h3><div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Bahan</th><th>Sistem</th><th>Fisik</th><th>Selisih</th><th>Alasan</th><th>Admin</th></tr></thead><tbody>${opnameRows}</tbody></table></div></section><section class="panel table-panel chart-wide"><h3>Stock Movement</h3><div class="table-wrap"><table><thead><tr><th>Tipe</th><th>Transaksi</th><th>Qty masuk</th><th>Qty keluar</th></tr></thead><tbody>${movementRows}</tbody></table></div></section></div>`;
  res.send(renderPage({ title: 'Laporan', user: req.session.user, active: 'reports', content }));
}));

app.get('/exports/inventory.csv', requireAuth, asyncRoute(async (req, res) => {
  const rows = await rpc('wms_inventory_rows', { p_search: req.query.search || null, p_category: req.query.category || null, p_location: req.query.location || null, p_status: req.query.status || null });
  sendCsv(res, 'stok-gudang.csv', [
    { label: 'Kode bahan', value: row => row.sku }, { label: 'Nama bahan', value: row => row.product_name },
    { label: 'Kategori', value: row => row.category }, { label: 'Satuan', value: row => row.uom },
    { label: 'Lokasi', value: row => row.location_code }, { label: 'Stok fisik', value: row => row.physical_qty },
    { label: 'Stok tersedia', value: row => row.available_qty }, { label: 'Minimum', value: row => row.minimum_stock },
    { label: 'Status', value: row => row.status }, { label: 'Waktu update', value: row => row.updated_at }
  ], rows);
}));

app.get('/exports/movement.csv', requireAuth, asyncRoute(async (req, res) => {
  sendCsv(res, 'stock-movement.csv', ledgerColumns(), await rpc('wms_movement_rows', getMovementParams(req.query)));
}));

app.get('/exports/:direction.csv', requireAuth, asyncRoute(async (req, res) => {
  if (!['inbound', 'outbound'].includes(req.params.direction)) return res.sendStatus(404);
  const params = getMovementParams({ ...req.query, type: req.params.direction === 'inbound' ? 'Barang Masuk / Put Away' : 'Barang Keluar / Issue to Production' });
  sendCsv(res, `${req.params.direction === 'inbound' ? 'barang-masuk' : 'barang-keluar'}.csv`, ledgerColumns(), await rpc('wms_movement_rows', params));
}));

app.get(['/warehouses', '/inspections', '/putaways', '/stock-adjustments', '/orders', '/pickings', '/shipments', '/returns', '/users'], requireAuth, (req, res) => res.redirect('/dashboard'));

function broadcastStockChange() {
  for (const client of sseClients) client.write('event: stock-change\ndata: {}\n\n');
}

if (!demoMode) {
  supabase.channel('wms-inventory-changes').on('postgres_changes', {
    event: '*', schema: 'public', table: 'inventory'
  }, () => broadcastStockChange()).subscribe(status => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.error('Supabase Realtime channel status:', status);
  });
}

app.use((error, req, res, next) => {
  const status = error.code === '23514' || error.code === 'P0001' ? 400 : 500;
  console.error('Request failed:', error.message || error);
  if (res.headersSent) return next(error);
  const message = status === 400 ? error.message : 'Terjadi kesalahan saat mengakses Supabase. Periksa konfigurasi dan log server.';
  if (req.accepts('html')) {
    return res.status(status).send(renderPage({ title: 'Kesalahan', user: req.session.user, active: '', content: `<section class="panel"><h3>${escapeHtml(message)}</h3><a class="btn btn-secondary" href="${req.get('referer') || '/dashboard'}">Kembali</a></section>` }));
  }
  res.status(status).json({ error: message });
});

app.listen(port, () => console.log(`WMS app listening on http://localhost:${port} (Supabase PostgreSQL)`));
