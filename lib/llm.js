/**
 * llm.js
 * Handles all Gemini API communication.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_CONTEXT = `
You are a data query assistant for an SAP Order-to-Cash (O2C) business dataset.

The dataset contains:
- Sales Orders
- Deliveries
- Billing Documents
- Payments
- Customers
- Products

The O2C flow: Customer → Sales Order → Delivery → Billing → Payment

You ONLY answer questions about this dataset.

Return JSON with:
{
  "intent": {...},
  "explanation": "..."
}
`.trim();

const OFF_TOPIC_HINTS = [
  'write a poem', 'tell me a joke', 'weather', 'movie',
  'sports', 'news', 'history', 'recipe'
];

function looksOffTopic(query) {
  const q = query.toLowerCase();
  return OFF_TOPIC_HINTS.some(hint => q.includes(hint));
}

// ✅ MAIN FUNCTION
export async function classifyQuery(userQuery) {

  const q = userQuery.toLowerCase();

  // 🔥 RULE-BASED INTENTS (FAST + RELIABLE)

  // Customers
  if (
    q.includes("customer")
  ) {
    return {
      intent: { type: "listCustomers" },
      explanation: "Fetching all customers"
    };
  }

  // Products
  if (
    q.includes("product")
  ) {
    return {
      intent: { type: "topProductsByBilling", limit: 5 },
      explanation: "Fetching top products"
    };
  }

  // Broken flows
  if (
    q.includes("broken") ||
    q.includes("not billed") ||
    q.includes("not delivered")
  ) {
    return {
      intent: { type: "brokenFlows", subType: "all" },
      explanation: "Fetching broken O2C flows"
    };
  }

  // Summary
  if (
    q.includes("summary") ||
    q.includes("stats")
  ) {
    return {
      intent: { type: "summaryStats" },
      explanation: "Fetching summary statistics"
    };
  }

  // Delivery status
  if (q.includes("delivery")) {
    return {
      intent: { type: "deliveryStatus", salesOrderId: "SO-740500" },
      explanation: "Fetching delivery status"
    };
  }

  // 🔥 OFF-TOPIC CHECK
  if (looksOffTopic(userQuery)) {
    return {
      intent: { type: 'irrelevant' },
      explanation: 'Off-topic query'
    };
  }

  // 🔥 FALLBACK TO GEMINI (OPTIONAL)
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("No API key");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `${SYSTEM_CONTEXT}

User question: "${userQuery}"

Return ONLY JSON.`;

    const result = await model.generateContent(prompt);

    const rawText = result.response?.text?.() || "";

    const cleaned = rawText.replace(/```json|```/g, '').trim();

    const parsed = JSON.parse(cleaned);

    if (!parsed.intent || !parsed.intent.type) {
      return {
        intent: { type: 'irrelevant' },
        explanation: 'Invalid LLM response'
      };
    }

    return parsed;

  } catch (err) {
    console.error("LLM Error:", err.message);

    return {
      intent: { type: 'irrelevant' },
      explanation: 'LLM failed'
    };
  }
}

// ✅ ANSWER GENERATOR
export async function generateAnswer(userQuery, queryResult) {

  // 🔥 DIRECT RESPONSE (NO LLM)

  if (!queryResult) {
    return "No data found.";
  }

  switch (queryResult.type) {

    case "listCustomers":
      return `Total customers: ${queryResult.customers.length}`;

    case "topProductsByBilling":
      return `Top ${queryResult.results.length} products fetched based on billing.`;

    case "brokenFlows":
      return `Found ${queryResult.results.length} broken flows in the system.`;

    case "customerOrders":
      return `Customer has ${queryResult.orders.length} orders.`;

    case "summaryStats":
      return `Summary stats calculated successfully.`;

    case "deliveryStatus":
      return `Delivery status fetched successfully.`;

    default:
      return "Query executed successfully.";
  }
}