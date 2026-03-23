'use client';

/**
 * ChatBox.js
 * Chat interface for natural language querying.
 * Shows conversation history, loading state, and structured result details.
 */

import { useState, useRef, useEffect } from 'react';

// Suggested example queries shown at start
const EXAMPLE_QUERIES = [
  'Which products are associated with the most billing documents?',
  'Show me the full flow for billing document 90504259',
  'Find sales orders that were delivered but not billed',
  'Give me a summary of the dataset',
  'Show all customers',
];

// Renders a single message bubble
function Message({ msg }) {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[85%] ${isUser ? 'order-1' : 'order-2'}`}>
        {/* Role label */}
        <div className={`text-xs mb-1 ${isUser ? 'text-right text-slate-500' : 'text-slate-500'}`}>
          {isUser ? 'You' : '🤖 Dodge AI'}
        </div>

        {/* Bubble */}
        <div className={`rounded-xl px-4 py-3 text-sm ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-slate-700 text-slate-100 rounded-bl-sm'
        }`}>
          {msg.content}
        </div>

        {/* Query details accordion */}
        {msg.queryResult && msg.queryResult.type !== 'error' && (
          <QueryDetails result={msg.queryResult} intent={msg.intent} />
        )}
      </div>
    </div>
  );
}

// Collapsible query details panel
function QueryDetails({ result, intent }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
      >
        <span>{open ? '▼' : '▶'}</span>
        <span>View raw query result</span>
      </button>

      {open && (
        <div className="mt-1 bg-slate-900 border border-slate-600 rounded-lg p-3 text-xs font-mono text-slate-400 overflow-x-auto max-h-48 overflow-y-auto">
          <div className="text-slate-500 mb-1">Intent: <span className="text-blue-400">{intent?.type}</span></div>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// Typing indicator
function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div className="bg-slate-700 rounded-xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1 items-center">
          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

export default function ChatBox({ onHighlightNodes }) {
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const messagesEndRef            = useRef(null);
  const inputRef                  = useRef(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendQuery(queryText) {
    const query = (queryText || input).trim();
    if (!query || loading) return;

    setInput('');
    setError(null);

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: query }]);
    setLoading(true);

    try {
      const res  = await fetch('/api/query', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ query }),
      });

      const data = await res.json();

      if (data.error) throw new Error(data.error);

      // Add assistant message
      setMessages(prev => [...prev, {
        role:        'assistant',
        content:     data.answer,
        intent:      data.intent,
        queryResult: data.queryResult,
      }]);

      // Tell parent to highlight nodes on graph
      if (data.highlightNodes?.length && onHighlightNodes) {
        onHighlightNodes(data.highlightNodes);
      }

    } catch (e) {
      setError(e.message);
      setMessages(prev => [...prev, {
        role:    'assistant',
        content: `❌ Error: ${e.message}`,
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuery();
    }
  }

  const showWelcome = messages.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 rounded-t-lg border border-slate-700 border-b-0">
        <span className="text-xs text-slate-400 font-medium">NATURAL LANGUAGE QUERY</span>
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); onHighlightNodes?.([]); }}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Clear chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-slate-800 border border-slate-700 border-t-0 border-b-0 px-3 py-3">

        {/* Welcome screen */}
        {showWelcome && (
          <div className="h-full flex flex-col justify-center">
            <div className="text-center mb-6">
              <div className="text-3xl mb-2">🔍</div>
              <h3 className="text-slate-200 font-semibold mb-1">Order-to-Cash Explorer</h3>
              <p className="text-slate-500 text-xs">Ask questions about the SAP O2C dataset</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-slate-500 text-center mb-2">Try these queries:</p>
              {EXAMPLE_QUERIES.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendQuery(q)}
                  className="w-full text-left text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg px-3 py-2 transition-colors border border-slate-600 hover:border-slate-500"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}

        {/* Typing indicator */}
        {loading && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="bg-slate-800 border border-slate-700 border-t-slate-600 rounded-b-lg p-2">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about orders, deliveries, billing..."
            rows={2}
            disabled={loading}
            className="flex-1 bg-slate-700 text-slate-200 placeholder-slate-500 rounded-lg px-3 py-2 text-sm resize-none border border-slate-600 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
          />
          <button
            onClick={() => sendQuery()}
            disabled={!input.trim() || loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors h-[52px] flex items-center gap-1"
          >
            {loading ? (
              <span className="animate-spin">⟳</span>
            ) : (
              <span>Send</span>
            )}
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-1 px-1">Press Enter to send · Shift+Enter for newline</p>
      </div>
    </div>
  );
}
