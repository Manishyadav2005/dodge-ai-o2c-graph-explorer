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
  console.log("🔥 INTENT:", intent);
console.log("🔥 RESULT:", queryResult);
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
  if (queryResult.type === 'result' && queryResult.data) {
  // ✅ Use structured summary instead of LLM
  answer = queryResult.summary || "Result generated from data.";
} else {
  // ── Step 5: Generate answer (DATA-DRIVEN ONLY) ──────────

answer = await generateAnswer(trimmedQuery, queryResult);
}
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

  // 🔥 CASE: Trace Billing / Document Flow
  if (result.type === 'traceDocument' && result.flow) {
    if (result.flow.billing?.id) {
      ids.push(String(result.flow.billing.id));
    }

    if (result.flow.salesOrder?.id) {
      ids.push(String(result.flow.salesOrder.id));
    }

    if (result.flow.customer?.id) {
      ids.push(String(result.flow.customer.id));
    }
  }

  // 🔥 CASE: Top Products
  if (result.type === 'topProductsByBilling') {
    result.results?.forEach(r => {
      ids.push(`PROD-${r.material}`);
    });
  }

  return ids;
}
