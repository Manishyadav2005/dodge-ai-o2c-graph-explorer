/**
 * graphBuilder.js
 * Builds an in-memory graph (nodes + edges) from JSON data files.
 * 
 * Node types: customer, salesOrder, delivery, billing, payment, product
 * Edges represent relationships between these entities.
 */

import path from 'path';
import fs from 'fs';

// Cache so we only build the graph once per server restart
let _graphCache = null;

/**
 * Load a JSON data file from /data directory
 */
function loadData(filename) {
  const filePath = path.join(process.cwd(), 'data', filename);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Build the full graph: { nodes, edges, rawData }
 */
export function buildGraph() {
  if (_graphCache) return _graphCache;

  // ── Load raw data ──────────────────────────────────────────────
  const salesOrders    = loadData('sales_orders.json');
  const orderItems     = loadData('sales_order_items.json');
  const billingHeaders = loadData('billing_headers.json');
  const billingItems   = loadData('billing_items.json');
  const deliveryHdrs   = loadData('delivery_headers.json');
  const deliveryItems  = loadData('delivery_items.json');
  const payments       = loadData('payments.json');
  const customers      = loadData('customers.json');
  const products       = loadData('products.json');

  const nodes = [];
  const edges = [];

  // Helper to avoid duplicate nodes
  const nodeIds = new Set();
  function addNode(id, type, label, metadata = {}) {
    if (!id || nodeIds.has(String(id))) return;
    nodeIds.add(String(id));
    nodes.push({ id: String(id), type, label, metadata });
  }

  // Helper to add edges (source → target with label)
  function addEdge(source, target, relationship) {
    if (!source || !target) return;
    edges.push({ source: String(source), target: String(target), relationship });
  }

  // ── 1. CUSTOMERS ──────────────────────────────────────────────
  customers.forEach(c => {
    addNode(c.customerId, 'customer', c.name || `Customer ${c.customerId}`, {
      name: c.name,
      isBlocked: c.isBlocked,
      creationDate: c.creationDate,
    });
  });

  // ── 2. SALES ORDERS ───────────────────────────────────────────
  salesOrders.forEach(so => {
    addNode(so.salesOrder, 'salesOrder', `SO-${so.salesOrder}`, {
      totalNetAmount: so.totalNetAmount,
      currency: so.currency,
      creationDate: so.creationDate,
      deliveryStatus: so.deliveryStatus,
      billingStatus: so.billingStatus,
      customer: so.soldToParty,
    });
    // Edge: Customer → Sales Order
    addEdge(so.soldToParty, so.salesOrder, 'PLACED_ORDER');
  });

  // ── 3. PRODUCTS (unique from order items) ─────────────────────
  const materialSet = new Set(orderItems.map(i => i.material));
  const productMap = {};
  products.forEach(p => {
    if (p.material) productMap[p.material] = p;
  });
  materialSet.forEach(mat => {
    if (!mat) return;
    const p = productMap[mat] || {};
    addNode(`PROD-${mat}`, 'product', `Product ${mat}`, {
      material: mat,
      productType: p.productType || 'N/A',
      baseUnit: p.baseUnit || 'PC',
    });
  });

  // ── 4. ORDER ITEMS → PRODUCTS ─────────────────────────────────
  orderItems.forEach(item => {
    if (!item.material) return;
    // Edge: Sales Order → Product
    addEdge(item.salesOrder, `PROD-${item.material}`, 'CONTAINS_PRODUCT');
  });

  // ── 5. DELIVERIES ─────────────────────────────────────────────
  deliveryHdrs.forEach(d => {
    addNode(d.deliveryDocument, 'delivery', `DEL-${d.deliveryDocument}`, {
      shippingPoint: d.shippingPoint,
      goodsMovementStatus: d.goodsMovementStatus,
      pickingStatus: d.pickingStatus,
      creationDate: d.creationDate,
    });
  });

  // Build a map: deliveryDocument → salesOrder (via delivery items)
  const deliveryToSalesOrder = {};
  deliveryItems.forEach(di => {
    if (di.salesOrder) {
      deliveryToSalesOrder[di.deliveryDocument] = di.salesOrder;
    }
  });

  // Edge: Sales Order → Delivery
  deliveryHdrs.forEach(d => {
    const so = deliveryToSalesOrder[d.deliveryDocument];
    if (so) addEdge(so, d.deliveryDocument, 'HAS_DELIVERY');
  });

  // ── 6. BILLING DOCUMENTS ──────────────────────────────────────
  billingHeaders.forEach(b => {
    addNode(b.billingDocument, 'billing', `BILL-${b.billingDocument}`, {
      totalNetAmount: b.totalNetAmount,
      currency: b.currency,
      billingDate: b.billingDate,
      isCancelled: b.isCancelled,
      accountingDocument: b.accountingDocument,
      soldToParty: b.soldToParty,
    });
  });

  // Build a map: billingDocument → deliveryDocument (via billing items)
  const billingToDelivery = {};
  billingItems.forEach(bi => {
    if (bi.referenceDelivery) {
      billingToDelivery[bi.billingDocument] = bi.referenceDelivery;
    }
  });

  // Edge: Delivery → Billing
  billingHeaders.forEach(b => {
    const del = billingToDelivery[b.billingDocument];
    if (del) {
      addEdge(del, b.billingDocument, 'HAS_BILLING');
    } else {
      // fallback: Customer → Billing if no delivery link
      if (b.soldToParty) addEdge(b.soldToParty, b.billingDocument, 'BILLED_TO');
    }
  });

  // ── 7. PAYMENTS ───────────────────────────────────────────────
  // Build map: accountingDocument → billing
  const accountingToBilling = {};
  billingHeaders.forEach(b => {
    if (b.accountingDocument) {
      accountingToBilling[b.accountingDocument] = b.billingDocument;
    }
  });

  // Deduplicate payments by accountingDocument
  const seenPayments = new Set();
  payments.forEach(p => {
    if (seenPayments.has(p.accountingDocument)) return;
    seenPayments.add(p.accountingDocument);

    addNode(`PAY-${p.accountingDocument}`, 'payment', `PAY-${p.accountingDocument}`, {
      accountingDocument: p.accountingDocument,
      customer: p.customer,
      amount: p.amount,
      currency: p.currency,
      clearingDate: p.clearingDate,
    });

    const bill = accountingToBilling[p.accountingDocument];
    if (bill) {
      addEdge(bill, `PAY-${p.accountingDocument}`, 'PAID_BY');
    }
  });

  // ── Store raw data for query engine ────────────────────────────
  _graphCache = {
    nodes,
    edges,
    rawData: {
      salesOrders,
      orderItems,
      billingHeaders,
      billingItems,
      deliveryHdrs,
      deliveryItems,
      payments,
      customers,
      products,
      // convenience maps
      deliveryToSalesOrder,
      billingToDelivery,
      accountingToBilling,
    },
  };

  console.log(
    `Graph built: ${nodes.length} nodes, ${edges.length} edges`
  );

  return _graphCache;
}


