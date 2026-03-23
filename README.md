# Dodge AI — Order-to-Cash Graph Explorer

A **Graph-Based Data Modeling and Query System** built for the Dodge AI Forward Deployed Engineer (FDE) hiring assignment.

The system converts SAP Order-to-Cash (O2C) business data into an interactive graph and allows users to explore relationships and ask natural language questions powered by Google Gemini.

---

## Live Demo

> Deploy link goes here after deployment

---

## Screenshots

| Graph Explorer | Chat Interface |
|---|---|
| *(graph screenshot)* | *(chat screenshot)* |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Next.js App                         │
│                                                         │
│  ┌──────────────────┐    ┌──────────────────────────┐   │
│  │   GraphView.js   │    │      ChatBox.js           │   │
│  │  (react-force-   │    │  - Message history        │   │
│  │   graph-2d)      │    │  - Input box              │   │
│  │  - Render nodes  │    │  - Example queries        │   │
│  │  - Highlight     │    │  - Raw result accordion   │   │
│  └────────┬─────────┘    └────────────┬─────────────┘   │
│           │ GET /api/graph             │ POST /api/query  │
│  ┌────────▼──────────────────────────▼─────────────┐    │
│  │              Next.js API Routes                   │    │
│  │  /api/graph/route.js    /api/query/route.js       │    │
│  └────────┬────────────────────────┬───────────────┘    │
│           │                        │                      │
│  ┌────────▼──────┐    ┌───────────▼──────────────────┐  │
│  │ graphBuilder  │    │  1. classifyQuery (Gemini)    │  │
│  │  - Load JSON  │    │  2. executeQuery (in-memory)  │  │
│  │  - Build      │    │  3. generateAnswer (Gemini)   │  │
│  │    nodes+edges│    └──────────────────────────────┘  │
│  └───────────────┘                                       │
└─────────────────────────────────────────────────────────┘
          │
┌─────────▼──────────────┐
│    /data/*.json         │
│  sales_orders.json      │
│  billing_headers.json   │
│  delivery_headers.json  │
│  payments.json          │
│  customers.json         │
│  products.json  ...     │
└────────────────────────┘
```

---

## Graph Modeling Decisions

### Node Types

| Type | Represents | Color |
|------|-----------|-------|
| `customer` | Business partner / buyer | Amber |
| `salesOrder` | SAP Sales Order header | Blue |
| `delivery` | Outbound delivery document | Green |
| `billing` | Billing document / invoice | Purple |
| `payment` | Accounts receivable payment | Red |
| `product` | Material / product | Cyan |

### Edge Relationships

| Edge | Meaning |
|------|---------|
| `Customer → Sales Order` | PLACED_ORDER |
| `Sales Order → Product` | CONTAINS_PRODUCT |
| `Sales Order → Delivery` | HAS_DELIVERY |
| `Delivery → Billing` | HAS_BILLING |
| `Billing → Payment` | PAID_BY |

### Why this model?
The graph directly mirrors the real-world O2C business flow. Each node type corresponds to a distinct SAP document type. Edges are derived from foreign-key relationships in the raw data (e.g. `referenceSdDocument` in delivery items links back to a sales order).

---

## Database / Storage Choice

**JSON files + in-memory graph** was chosen for this assignment because:

- Zero setup — no database server to install or configure
- The dataset is small enough (~1,000 records across all tables) to fit comfortably in memory
- The graph is built once on first request and cached for subsequent requests
- For production, this would be replaced with **Neo4j** (native graph DB) or **PostgreSQL with pgvector**

---

## LLM Prompting Strategy

### Two-step LLM pipeline:

**Step 1 — Query Classification (`classifyQuery`)**

The system prompt gives Gemini a precise schema of available query types. Gemini returns a structured JSON intent object (e.g. `{ "type": "traceDocument", "documentId": "90504259" }`). This is deterministic and machine-readable.

**Step 2 — Answer Generation (`generateAnswer`)**

After the query engine executes the intent and returns raw data, Gemini is asked to convert that data into a natural language response. The prompt explicitly states: *"Write a clear answer based ONLY on this data. Do NOT add any information not in the data."*

This two-step approach prevents hallucination — the LLM never generates answers from its own knowledge, only from the query results.

---

## Guardrails

Three layers of protection against off-topic queries:

1. **Client-side keyword filter** — fast check for obvious off-topic patterns (poems, jokes, weather, etc.) before any API call
2. **LLM system prompt** — Gemini is explicitly instructed: *"You ONLY answer questions about this dataset. NEVER answer general knowledge..."*
3. **Intent validation** — if Gemini returns `{ "type": "irrelevant" }`, the API returns a canned refusal message without executing any query

Example refusal response:
> "⚠️ This system is designed to answer questions related to the Order-to-Cash dataset only. Please ask about sales orders, deliveries, billing documents, payments, customers, or products."

---

## Supported Queries

| Query | Intent Type |
|-------|-------------|
| Which products have the most billing docs? | `topProductsByBilling` |
| Trace full flow of billing doc 90504259 | `traceDocument` |
| Find orders delivered but not billed | `brokenFlows` |
| Show orders for customer 310000108 | `customerOrders` |
| Summary statistics of the dataset | `summaryStats` |
| List all customers | `listCustomers` |
| Delivery status for sales order 740506 | `deliveryStatus` |

---

## Setup & Running Locally

### Prerequisites
- Node.js 18+
- A free [Google Gemini API key](https://ai.google.dev)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/dodge-ai-fde
cd dodge-ai-fde

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.local.example .env.local

# 4. Add your Gemini API key to .env.local
# Open .env.local and set:
# GEMINI_API_KEY=your_key_here

# 5. Run development server
npm run dev

# 6. Open in browser
# http://localhost:3000
```

---

## Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variable in Vercel dashboard:
# GEMINI_API_KEY = your_key_here
```

---

## Folder Structure

```
dodge-ai-fde/
├── app/
│   ├── api/
│   │   ├── graph/route.js      # Returns graph nodes + edges
│   │   └── query/route.js      # Handles NL queries
│   ├── globals.css
│   ├── layout.js
│   └── page.js                 # Main UI (graph + chat)
├── components/
│   ├── GraphView.js            # react-force-graph-2d visualization
│   └── ChatBox.js              # Chat interface
├── lib/
│   ├── graphBuilder.js         # Builds in-memory graph from JSON
│   ├── queryEngine.js          # Executes structured queries
│   └── llm.js                  # Gemini API integration
├── data/
│   ├── sales_orders.json
│   ├── sales_order_items.json
│   ├── billing_headers.json
│   ├── billing_items.json
│   ├── delivery_headers.json
│   ├── delivery_items.json
│   ├── payments.json
│   ├── customers.json
│   ├── products.json
│   └── journal_entries.json
├── .env.local.example
├── .gitignore
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Frontend | React 18 + Tailwind CSS |
| Graph Viz | react-force-graph-2d |
| LLM | Google Gemini 1.5 Flash (free tier) |
| Data | JSON files (in-memory graph) |
| Deploy | Vercel |
