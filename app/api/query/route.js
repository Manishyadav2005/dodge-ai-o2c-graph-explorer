/**
 * /api/query/route.js
 * Main API endpoint for the chat interface.
 * 
 * POST /api/query
 * Body: { query: string, history?: Array<{role, content}> }
 * Returns: { answer, intent, queryResult, highlightNodes }
 */

import { buildGraph } from '../../../lib/graphBuilder';
import { classifyQuery, generateAnswer } from '../../../lib/llm';
import { executeQuery } from '../../../lib/queryEngine';

export async function POST(request) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return Response.json({ error: 'Query is required.' }, { status: 400 });
    }

    const trimmedQuery = query.trim();

    // ── Step 1: Build graph (cached after first call) ─────────────
  try {
  buildGraph();
} catch (err) {
  console.error("❌ buildGraph failed:", err.message);
}

    // ── Step 2: Classify query with LLM ──────────────────────────
    const { intent, explanation } = await classifyQuery(trimmedQuery);

    // ── Step 3: Guardrail – reject irrelevant queries ─────────────
   if (!intent || !intent.type || intent.type === 'irrelevant') {
      return Response.json({
        answer: '⚠️ This system is designed to answer questions related to the Order-to-Cash dataset only. Please ask about sales orders, deliveries, billing documents, payments, customers, or products.',
        intent: { type: 'irrelevant' },
        queryResult: null,
        highlightNodes: [],
      });
    }

    // ── Step 4: Execute structured query ─────────────────────────
   let queryResult;

try {
  queryResult = executeQuery(intent);
} catch (err) {
  console.error("❌ executeQuery failed:", err.message);

  return Response.json({
    answer: "Query execution failed.",
    intent,
    queryResult: null,
    highlightNodes: [],
  });
}

    if (queryResult.type === 'error') {
      return Response.json({
        answer: `❌ ${queryResult.message}`,
        intent,
        queryResult,
        highlightNodes: [],
      });
    }

    // ── Step 5: Generate natural language answer via LLM ──────────
    let answer = "";

try {
  answer = await generateAnswer(trimmedQuery, queryResult);
} catch (err) {
  console.error("❌ generateAnswer failed:", err.message);
  answer = queryResult.summary || "Answer generated from data.";
}

    // ── Step 6: Determine nodes to highlight on graph ─────────────
    const highlightNodes = extractHighlightNodes(intent, queryResult);

    return Response.json({
      answer,
      intent,
      explanation,
      queryResult,
      highlightNodes,
    });

  } catch (err) {
    console.error('API Error:', err);
    return Response.json(
      { error: 'Internal server error. Please try again.', details: err.message },
      { status: 500 }
    );
  }
}

/**
 * Returns an array of node IDs to highlight on the graph
 * based on the query type and result.
 */
function extractHighlightNodes(intent, result) {
  const ids = [];

  switch (result.type) {
    case 'traceDocument': {
      const flow = result.flow;
      if (flow.customer?.id)   ids.push(String(flow.customer.id));
      if (flow.salesOrder?.id) ids.push(String(flow.salesOrder.id));
      if (flow.delivery?.id)   ids.push(String(flow.delivery.id));
      if (flow.billing?.id)    ids.push(String(flow.billing.id));
      flow.payment?.forEach(p => ids.push(`PAY-${p.id}`));
      flow.deliveries?.forEach(d => ids.push(String(d.id)));
      flow.billings?.forEach(b => ids.push(String(b.id)));
      break;
    }
    case 'topProductsByBilling': {
      result.results?.forEach(r => ids.push(`PROD-${r.material}`));
      break;
    }
    case 'brokenFlows': {
      result.results?.slice(0, 10).forEach(r => ids.push(String(r.salesOrder)));
      break;
    }
    case 'customerOrders': {
      if (result.customer?.customerId) ids.push(String(result.customer.customerId));
      result.orders?.forEach(o => ids.push(String(o.id)));
      break;
    }
  }

  return ids;
}
