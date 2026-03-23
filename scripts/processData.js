/**
 * processData.js
 * Reads raw JSONL files and converts them to clean JSON arrays
 * stored in /data folder for the app to use.
 */

const fs = require('fs');
const path = require('path');

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`✅ Written ${data.length} records → ${path.basename(filePath)}`);
}

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// --- Sales Order Headers ---
const sohRaw = readJsonl('/tmp/soh.jsonl');
const salesOrders = sohRaw.map(r => ({
  salesOrder: r.salesOrder,
  soldToParty: r.soldToParty,
  totalNetAmount: parseFloat(r.totalNetAmount) || 0,
  currency: r.transactionCurrency,
  creationDate: r.creationDate,
  deliveryStatus: r.overallDeliveryStatus,
  billingStatus: r.overallOrdReltdBillgStatus,
  salesOrderType: r.salesOrderType,
}));
writeJson(path.join(dataDir, 'sales_orders.json'), salesOrders);

// --- Sales Order Items ---
const soiRaw = readJsonl('/tmp/soi1.jsonl');
const salesOrderItems = soiRaw.map(r => ({
  salesOrder: r.salesOrder,
  item: r.salesOrderItem,
  material: r.material,
  quantity: parseFloat(r.requestedQuantity) || 0,
  unit: r.requestedQuantityUnit,
  netAmount: parseFloat(r.netAmount) || 0,
  currency: r.transactionCurrency,
  plant: r.productionPlant,
}));
writeJson(path.join(dataDir, 'sales_order_items.json'), salesOrderItems);

// --- Billing Document Headers ---
const bdhRaw = readJsonl('/tmp/bdh.jsonl');
const billingHeaders = bdhRaw.map(r => ({
  billingDocument: r.billingDocument,
  billingType: r.billingDocumentType,
  soldToParty: r.soldToParty,
  totalNetAmount: parseFloat(r.totalNetAmount) || 0,
  currency: r.transactionCurrency,
  billingDate: r.billingDocumentDate,
  creationDate: r.creationDate,
  isCancelled: r.billingDocumentIsCancelled || false,
  accountingDocument: r.accountingDocument,
  companyCode: r.companyCode,
}));
writeJson(path.join(dataDir, 'billing_headers.json'), billingHeaders);

// --- Billing Document Items ---
const bdiRaw = readJsonl('/tmp/bdi.jsonl');
const billingItems = bdiRaw.map(r => ({
  billingDocument: r.billingDocument,
  item: r.billingDocumentItem,
  material: r.material,
  quantity: parseFloat(r.billingQuantity) || 0,
  netAmount: parseFloat(r.netAmount) || 0,
  currency: r.transactionCurrency,
  referenceDelivery: r.referenceSdDocument, // delivery doc
  referenceDeliveryItem: r.referenceSdDocumentItem,
}));
writeJson(path.join(dataDir, 'billing_items.json'), billingItems);

// --- Delivery Headers ---
const odhRaw = readJsonl('/tmp/odh.jsonl');
const deliveryHeaders = odhRaw.map(r => ({
  deliveryDocument: r.deliveryDocument,
  creationDate: r.creationDate,
  shippingPoint: r.shippingPoint,
  goodsMovementStatus: r.overallGoodsMovementStatus,
  pickingStatus: r.overallPickingStatus,
  deliveryBlockReason: r.deliveryBlockReason,
}));
writeJson(path.join(dataDir, 'delivery_headers.json'), deliveryHeaders);

// --- Delivery Items ---
const odiRaw = readJsonl('/tmp/odi.jsonl');
const deliveryItems = odiRaw.map(r => ({
  deliveryDocument: r.deliveryDocument,
  item: r.deliveryDocumentItem,
  salesOrder: r.referenceSdDocument, // links back to sales order
  salesOrderItem: r.referenceSdDocumentItem,
  quantity: parseFloat(r.actualDeliveryQuantity) || 0,
  plant: r.plant,
}));
writeJson(path.join(dataDir, 'delivery_items.json'), deliveryItems);

// --- Payments ---
const payRaw = readJsonl('/tmp/pay.jsonl');
const payments = payRaw.map(r => ({
  accountingDocument: r.accountingDocument,
  item: r.accountingDocumentItem,
  customer: r.customer,
  amount: parseFloat(r.amountInTransactionCurrency) || 0,
  currency: r.transactionCurrency,
  clearingDate: r.clearingDate,
  postingDate: r.postingDate,
  clearingDocument: r.clearingAccountingDocument,
}));
writeJson(path.join(dataDir, 'payments.json'), payments);

// --- Business Partners (Customers) ---
const bpRaw = readJsonl('/tmp/bp.jsonl');
const customers = bpRaw.map(r => ({
  customerId: r.businessPartner,
  name: r.businessPartnerFullName || r.businessPartnerName,
  category: r.businessPartnerCategory,
  isBlocked: r.businessPartnerIsBlocked || false,
  creationDate: r.creationDate,
}));
writeJson(path.join(dataDir, 'customers.json'), customers);

// --- Products ---
const prodRaw = readJsonl('/tmp/prod.jsonl');
const products = prodRaw.map(r => ({
  material: r.product || r.material,
  productType: r.productType,
  baseUnit: r.baseUnit,
  weightUnit: r.weightUnit,
}));
writeJson(path.join(dataDir, 'products.json'), products);

// --- Journal Entries ---
const jeiRaw = readJsonl('/tmp/jei.jsonl');
const journalEntries = jeiRaw.map(r => ({
  accountingDocument: r.accountingDocument,
  item: r.ledgerGLLineItem || r.accountingDocumentItem,
  fiscalYear: r.fiscalYear,
  companyCode: r.companyCode,
  glAccount: r.glAccount,
  amount: parseFloat(r.amountInTransactionCurrency) || 0,
  currency: r.transactionCurrency,
  postingDate: r.postingDate,
  customer: r.customer,
  referenceDocument: r.referenceDocument,
}));
writeJson(path.join(dataDir, 'journal_entries.json'), journalEntries);

console.log('\n🎉 Data processing complete!');
