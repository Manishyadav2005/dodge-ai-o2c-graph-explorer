/**
 * /api/graph/route.js
 * Returns the full graph (nodes + edges) for the frontend.
 * Called once on page load.
 */

import { buildGraph } from '../../../lib/graphBuilder';

export async function GET() {
  try {
    const { nodes, edges } = buildGraph();

    // Return only what the visualization needs
    return Response.json({ nodes, edges, nodeCount: nodes.length, edgeCount: edges.length });
  } catch (err) {
    console.error('Graph API Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
