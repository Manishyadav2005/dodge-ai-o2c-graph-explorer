/**
 * queryEngine.js
 * Executes structured queries against the in-memory dataset.
 * The LLM returns a query "intent" and this engine runs the actual logic.
 * 
 * Supported intents:
 *  - topProductsByBilling
 *  - traceDocument (billing or sales order)
 *  - brokenFlows
 *  - customerOrders
 *  - deliveryStatus
 *  - summaryStats
 */

import { buildGraph } from './graphBuilder';

export function executeQuery(intent) {
  const { rawData } = buildGraph();
  const {
    salesOrders, orderItems, billingHeaders, billingItems,
    deliveryHdrs, deliveryItems, payments, customers, products,
    deliveryToSalesOrder, billingToDelivery, accountingToBilling,
  } = rawData;

  switch (intent.type) {
    // ── Which products appear in the most billing docs? ──────────
    case 'topProductsByBilling': {
      const limit = intent.limit || 5;
      const countMap = {};
      billingItems.forEach(bi => {
        if (bi.material) {
          countMap[bi.material] = (countMap[bi.material] || 0) + 1;
        }
      });
      const sorted = Object.entries(countMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([material, count]) => ({ material, billingCount: count }));
      return {
        type: 'topProductsByBilling',
        results: sorted,
        summary: `Top ${sorted.length} products by billing document count.`,
      };
    }

    // ── Trace full flow of a billing document ────────────────────
    case 'traceDocument': {
      const docId = String(intent.documentId || '').trim();
      if (!docId) return { type: 'error', message: 'No document ID provided.' };

      // Try billing document
      const billing = billingHeaders.find(b => b.billingDocument === docId);
      if (billing) {
        const deliveryId = billingToDelivery[docId];
        const delivery   = deliveryHdrs.find(d => d.deliveryDocument === deliveryId);
        const salesOrderId = deliveryId ? deliveryToSalesOrder[deliveryId] : null;
        const salesOrder   = salesOrderId ? salesOrders.find(s => s.salesOrder === salesOrderId) : null;
        const customer     = salesOrder   ? customers.find(c => c.customerId === salesOrder.soldToParty) : null;
        const paymentRecs  = payments.filter(p => p.accountingDocument === billing.accountingDocument);

        return {
          type: 'traceDocument',
          flow: {
            customer:    customer    ? { id: customer.customerId, name: customer.name } : { id: billing.soldToParty },
            salesOrder:  salesOrder  ? { id: salesOrder.salesOrder, amount: salesOrder.totalNetAmount } : null,
            delivery:    delivery    ? { id: delivery.deliveryDocument, status: delivery.goodsMovementStatus } : null,
            billing:     { id: billing.billingDocument, amount: billing.totalNetAmount, cancelled: billing.isCancelled },
            payment:     paymentRecs.length ? paymentRecs.map(p => ({ id: p.accountingDocument, amount: p.amount })) : null,
          },
          summary: `Full O2C flow traced for billing document ${docId}.`,
        };
      }

      // Try sales order
      const so = salesOrders.find(s => s.salesOrder === docId);
      if (so) {
        const relDeliveries = deliveryHdrs.filter(d => deliveryToSalesOrder[d.deliveryDocument] === docId);
        const relBillings   = relDeliveries.flatMap(d =>
          billingHeaders.filter(b => billingToDelivery[b.billingDocument] === d.deliveryDocument)
        );
        const customer = customers.find(c => c.customerId === so.soldToParty);

        return {
          type: 'traceDocument',
          flow: {
            customer:   customer ? { id: customer.customerId, name: customer.name } : { id: so.soldToParty },
            salesOrder: { id: so.salesOrder, amount: so.totalNetAmount },
            deliveries: relDeliveries.map(d => ({ id: d.deliveryDocument, status: d.goodsMovementStatus })),
            billings:   relBillings.map(b => ({ id: b.billingDocument, amount: b.totalNetAmount })),
          },
          summary: `Flow traced for Sales Order ${docId}.`,
        };
      }

      return { type: 'error', message: `Document "${docId}" not found in dataset.` };
    }

    // ── Find orders with incomplete/broken flows ─────────────────
    case 'brokenFlows': {
      const subType = intent.subType || 'all';
      const results = [];

      // Build lookup sets
      const deliveredOrders = new Set(Object.values(deliveryToSalesOrder));
      const billedDeliveries = new Set(Object.keys(billingToDelivery));
      const deliveriesSet = new Set(deliveryHdrs.map(d => d.deliveryDocument));

      salesOrders.forEach(so => {
        const hasDelivery = deliveredOrders.has(so.salesOrder);
        const soDeliveries = deliveryHdrs.filter(d => deliveryToSalesOrder[d.deliveryDocument] === so.salesOrder);
        const hasBilling = soDeliveries.some(d => billedDeliveries.has(d.deliveryDocument));

        const deliveredNotBilled = hasDelivery && !hasBilling;
        const billedNotDelivered = !hasDelivery && so.billingStatus === 'C';

        if (subType === 'deliveredNotBilled' && deliveredNotBilled) {
          results.push({ salesOrder: so.salesOrder, issue: 'Delivered but not billed', amount: so.totalNetAmount });
        } else if (subType === 'billedNotDelivered' && billedNotDelivered) {
          results.push({ salesOrder: so.salesOrder, issue: 'Billed without delivery', amount: so.totalNetAmount });
        } else if (subType === 'all' && (deliveredNotBilled || billedNotDelivered)) {
          results.push({
            salesOrder: so.salesOrder,
            issue: deliveredNotBilled ? 'Delivered but not billed' : 'Billed without delivery',
            amount: so.totalNetAmount,
          });
        }
      });

      return {
        type: 'brokenFlows',
        count: results.length,
        results: results.slice(0, 20),
        summary: `Found ${results.length} orders with broken/incomplete O2C flow.`,
      };
    }

    // ── Orders for a specific customer ───────────────────────────
    case 'customerOrders': {
      const customerId = String(intent.customerId || '').trim();
      const customer = customers.find(c =>
        c.customerId === customerId ||
        c.name.toLowerCase().includes((intent.customerName || '').toLowerCase())
      );
      if (!customer && !customerId) return { type: 'error', message: 'Customer not found.' };

      const id = customer ? customer.customerId : customerId;
      const orders = salesOrders.filter(s => s.soldToParty === id);
      const totalValue = orders.reduce((sum, o) => sum + o.totalNetAmount, 0);

      return {
        type: 'customerOrders',
        customer: customer || { customerId: id },
        orderCount: orders.length,
        totalValue: totalValue.toFixed(2),
        orders: orders.slice(0, 15).map(o => ({ id: o.salesOrder, amount: o.totalNetAmount, date: o.creationDate })),
        summary: `Customer ${customer?.name || id} has ${orders.length} orders totaling ${totalValue.toFixed(2)} INR.`,
      };
    }

    // ── Overall summary stats ─────────────────────────────────────
    case 'summaryStats': {
      const totalRevenueBilled = billingHeaders.reduce((s, b) => s + b.totalNetAmount, 0);
      const totalPayments = payments.reduce((s, p) => s + p.amount, 0);
      const cancelledBillings = billingHeaders.filter(b => b.isCancelled).length;
      const deliveredOrders = new Set(Object.values(deliveryToSalesOrder)).size;

      return {
        type: 'summaryStats',
        stats: {
          totalSalesOrders: salesOrders.length,
          totalCustomers: customers.length,
          totalDeliveries: deliveryHdrs.length,
          totalBillingDocs: billingHeaders.length,
          cancelledBillings,
          totalRevenueBilled: totalRevenueBilled.toFixed(2),
          totalPaymentsReceived: totalPayments.toFixed(2),
          totalProducts: new Set(orderItems.map(i => i.material)).size,
        },
        summary: `Dataset contains ${salesOrders.length} sales orders, ${billingHeaders.length} billing documents, and ${payments.length} payment records.`,
      };
    }

    // ── List all customers ────────────────────────────────────────
    case 'listCustomers': {
      return {
        type: 'listCustomers',
        customers: customers.map(c => ({ id: c.customerId, name: c.name, isBlocked: c.isBlocked })),
        summary: `Found ${customers.length} customers in the dataset.`,
      };
    }

    // ── Delivery status for a sales order ────────────────────────
    case 'deliveryStatus': {
      const soId = String(intent.salesOrderId || '').trim();
      const so = salesOrders.find(s => s.salesOrder === soId);
      if (!so) return { type: 'error', message: `Sales order ${soId} not found.` };

      const delivs = deliveryHdrs.filter(d => deliveryToSalesOrder[d.deliveryDocument] === soId);

      return {
        type: 'deliveryStatus',
        salesOrder: soId,
        deliveries: delivs.map(d => ({
          id: d.deliveryDocument,
          goodsMovement: d.goodsMovementStatus,
          picking: d.pickingStatus,
          date: d.creationDate,
        })),
        summary: `Sales order ${soId} has ${delivs.length} delivery document(s).`,
      };
    }case "billingDetails": {
  const billing = billingHeaders.find(
    b => b.billingDocument === intent.billingId
  );

  return {
    type: "billingDetails",
    billing: billing
      ? {
          id: billing.billingDocument,
          amount: billing.totalNetAmount,
          customer: billing.soldToParty
        }
      : null
  };
}

    default:
      return { type: 'error', message: 'Unknown query type.' };
  }
}


