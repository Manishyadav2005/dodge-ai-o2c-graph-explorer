'use client';

/**
 * page.js
 * Main application page.
 * Left panel: Graph visualization
 * Right panel: Chat interface
 */

import { useState } from 'react';
import GraphView from '../components/GraphView';
import ChatBox from '../components/ChatBox';

export default function Home() {
  // Node IDs to highlight on graph (set by chat responses)
  const [highlightNodes, setHighlightNodes] = useState([]);

  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">D</span>
          </div>
          <div>
            <h1 className="text-white text-sm font-semibold leading-none">Dodge AI</h1>
            <p className="text-slate-500 text-xs">Order-to-Cash Graph Explorer</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {highlightNodes.length > 0 && (
            <button
              onClick={() => setHighlightNodes([])}
              className="text-xs text-yellow-400 hover:text-yellow-300 border border-yellow-800 px-2 py-1 rounded"
            >
              Clear highlights ({highlightNodes.length})
            </button>
          )}
          <div className="flex gap-1">
            {[
              { color: 'bg-amber-400',  label: 'Customer' },
              { color: 'bg-blue-500',   label: 'Order' },
              { color: 'bg-green-500',  label: 'Delivery' },
              { color: 'bg-purple-500', label: 'Billing' },
              { color: 'bg-red-500',    label: 'Payment' },
              { color: 'bg-cyan-500',   label: 'Product' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1 ml-2">
                <div className={`w-2 h-2 rounded-full ${item.color}`} />
                <span className="text-slate-500 text-xs">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── Main content: graph + chat ───────────────────────────── */}
      <div className="flex flex-1 gap-3 p-3 overflow-hidden">

        {/* Left: Graph panel */}
        <div className="flex-1 min-w-0 flex flex-col">
          <GraphView highlightNodes={highlightNodes} />
        </div>

        {/* Right: Chat panel */}
        <div className="w-[400px] flex-shrink-0 flex flex-col">
          <ChatBox onHighlightNodes={setHighlightNodes} />
        </div>

      </div>
    </div>
  );
}
