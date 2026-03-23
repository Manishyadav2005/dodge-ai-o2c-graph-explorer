'use client';

/**
 * GraphView.js
 * Interactive force-directed graph visualization.
 * Uses react-force-graph-2d to render nodes and edges.
 * Supports: node click (show metadata), highlight nodes from chat answers.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import because react-force-graph uses browser APIs (canvas)
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

// Color mapping for each node type
const NODE_COLORS = {
  customer:   '#f59e0b', // amber
  salesOrder: '#3b82f6', // blue
  delivery:   '#10b981', // green
  billing:    '#a855f7', // purple
  payment:    '#ef4444', // red
  product:    '#06b6d4', // cyan
};

const NODE_LABELS = {
  customer:   'Customer',
  salesOrder: 'Sales Order',
  delivery:   'Delivery',
  billing:    'Billing',
  payment:    'Payment',
  product:    'Product',
};

export default function GraphView({ highlightNodes = [] }) {
  const [graphData, setGraphData]     = useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [stats, setStats]             = useState({});
  const graphRef = useRef(null);

  const highlightSet = new Set(highlightNodes);

  // ── Load graph data on mount ─────────────────────────────────
  useEffect(() => {
    async function loadGraph() {
      try {
        const res  = await fetch('/api/graph');
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        // react-force-graph expects "links" not "edges"
        const links = data.edges.map(e => ({
          source: e.source,
          target: e.target,
          relationship: e.relationship,
        }));

        setGraphData({ nodes: data.nodes, links });
        setStats({ nodes: data.nodeCount, edges: data.edgeCount });
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    loadGraph();
  }, []);

  // ── Custom node canvas rendering ─────────────────────────────
  const paintNode = useCallback((node, ctx, globalScale) => {
    const isHighlighted = highlightSet.has(node.id);
    const color  = NODE_COLORS[node.type] || '#94a3b8';
    const radius = isHighlighted ? 8 : (node.type === 'customer' ? 7 : 5);
    const label  = node.label || node.id;

    // Glow effect for highlighted nodes
    if (isHighlighted) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI);
      ctx.fillStyle = color + '44';
      ctx.fill();
    }

    // Node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = isHighlighted ? color : color + 'cc';
    ctx.fill();

    // White ring for selected node
    if (selectedNode?.id === node.id) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }

    // Label at certain zoom levels
    if (globalScale > 1.5 || isHighlighted) {
      const fontSize = 10 / globalScale;
      ctx.font = `${fontSize}px Inter, sans-serif`;
      ctx.fillStyle = '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.fillText(label.length > 15 ? label.slice(0, 15) + '…' : label, node.x, node.y + radius + fontSize + 2);
    }
  }, [selectedNode, highlightNodes]);

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node);
  }, []);

  // ── Legend ────────────────────────────────────────────────────
  const Legend = () => (
    <div className="flex flex-wrap gap-2 p-2 bg-slate-800 rounded-lg border border-slate-700">
      {Object.entries(NODE_COLORS).map(([type, color]) => (
        <div key={type} className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-xs text-slate-400">{NODE_LABELS[type]}</span>
        </div>
      ))}
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-full bg-slate-900 rounded-lg">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-slate-400 text-sm">Building graph...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-full bg-slate-900 rounded-lg">
      <p className="text-red-400 text-sm">Graph error: {error}</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Stats bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 rounded-lg border border-slate-700">
        <span className="text-xs text-slate-400 font-medium">GRAPH EXPLORER</span>
        <div className="flex gap-3 text-xs text-slate-400">
          <span>🔵 {stats.nodes} nodes</span>
          <span>🔗 {stats.edges} edges</span>
          {highlightNodes.length > 0 && (
            <span className="text-yellow-400">✨ {highlightNodes.length} highlighted</span>
          )}
        </div>
      </div>

      {/* Legend */}
      <Legend />

      {/* Graph canvas */}
      <div className="flex-1 bg-slate-900 rounded-lg border border-slate-700 overflow-hidden relative">
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          nodeCanvasObject={paintNode}
          nodeCanvasObjectMode={() => 'replace'}
          linkColor={() => '#334155'}
          linkWidth={link => 1}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={1}
          linkDirectionalParticles={2}
          linkDirectionalParticleSpeed={0.003}
          linkDirectionalParticleColor={() => '#475569'}
          onNodeClick={handleNodeClick}
          backgroundColor="#0f172a"
          cooldownTicks={100}
          nodeRelSize={4}
        />

        {/* Node detail panel */}
        {selectedNode && (
          <div className="absolute bottom-3 left-3 right-3 bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl max-h-48 overflow-y-auto">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: NODE_COLORS[selectedNode.type] || '#94a3b8' }}
                  />
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                    {NODE_LABELS[selectedNode.type] || selectedNode.type}
                  </span>
                </div>
                <p className="text-sm font-mono text-white mt-1">{selectedNode.label}</p>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-slate-500 hover:text-slate-300 text-lg leading-none ml-2"
              >×</button>
            </div>
            {/* Metadata grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {selectedNode.metadata && Object.entries(selectedNode.metadata).map(([key, val]) => {
                if (val === null || val === undefined || val === '') return null;
                const displayVal = typeof val === 'boolean' ? (val ? 'Yes' : 'No') :
                                   typeof val === 'string' && val.includes('T00:00') ? val.split('T')[0] :
                                   String(val);
                return (
                  <div key={key} className="flex flex-col">
                    <span className="text-slate-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className="text-slate-300 font-mono truncate">{displayVal}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
