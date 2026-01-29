'use client';

import { useState, useEffect, useRef } from 'react';

interface JsonViewerProps {
  data: any;
  isDark?: boolean;
  id?: string; // Unique identifier for this viewer
}

interface JsonNodeProps {
  data: any;
  name?: string;
  isLast?: boolean;
  depth?: number;
  isDark?: boolean;
}

// Store heights for different viewers
const viewerHeights: Record<string, number> = {};

// Load heights from localStorage on module load
if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem('jsonViewerHeights');
    if (saved) {
      const heights = JSON.parse(saved);
      Object.assign(viewerHeights, heights);
    }
  } catch (e) {
    console.error('Error loading viewer heights:', e);
  }
}

function JsonNode({ data, name, isLast = true, depth = 0, isDark = false }: JsonNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (data === null) {
    return (
      <div className="flex items-start">
        {name && <span className="text-blue-600 dark:text-blue-400">&quot;{name}&quot;: </span>}
        <span className="text-gray-500 dark:text-gray-400">null</span>
        {!isLast && <span>,</span>}
      </div>
    );
  }

  if (typeof data === 'undefined') {
    return (
      <div className="flex items-start">
        {name && <span className="text-blue-600 dark:text-blue-400">&quot;{name}&quot;: </span>}
        <span className="text-gray-500 dark:text-gray-400">undefined</span>
        {!isLast && <span>,</span>}
      </div>
    );
  }

  if (typeof data === 'boolean') {
    return (
      <div className="flex items-start">
        {name && <span className="text-blue-600 dark:text-blue-400">&quot;{name}&quot;: </span>}
        <span className="text-purple-600 dark:text-purple-400">{data.toString()}</span>
        {!isLast && <span>,</span>}
      </div>
    );
  }

  if (typeof data === 'number') {
    return (
      <div className="flex items-start">
        {name && <span className="text-blue-600 dark:text-blue-400">&quot;{name}&quot;: </span>}
        <span className="text-green-600 dark:text-green-400">{data}</span>
        {!isLast && <span>,</span>}
      </div>
    );
  }

  if (typeof data === 'string') {
    return (
      <div className="flex items-start">
        {name && <span className="text-blue-600 dark:text-blue-400">&quot;{name}&quot;: </span>}
        <span className="text-orange-600 dark:text-orange-400">&quot;{data}&quot;</span>
        {!isLast && <span>,</span>}
      </div>
    );
  }

  if (Array.isArray(data)) {
    const isEmpty = data.length === 0;

    return (
      <div>
        <div className="flex items-start">
          {name && <span className="text-blue-600 dark:text-blue-400">&quot;{name}&quot;: </span>}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="hover:bg-gray-100 dark:hover:bg-gray-800 px-1 rounded"
          >
            <span className="text-gray-600 dark:text-gray-400 mr-1">
              {isExpanded ? '▼' : '▶'}
            </span>
            <span>[</span>
            {!isExpanded && <span className="text-gray-500 dark:text-gray-400 ml-1">{data.length} items</span>}
            {(!isExpanded || isEmpty) && <span>]</span>}
          </button>
        </div>
        {isExpanded && !isEmpty && (
          <div className="ml-4 border-l border-gray-300 dark:border-gray-600 pl-2">
            {data.map((item, index) => (
              <JsonNode
                key={index}
                data={item}
                isLast={index === data.length - 1}
                depth={depth + 1}
                isDark={isDark}
              />
            ))}
          </div>
        )}
        {isExpanded && !isEmpty && <div>]{!isLast && ','}</div>}
      </div>
    );
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data);
    const isEmpty = keys.length === 0;

    return (
      <div>
        <div className="flex items-start">
          {name && <span className="text-blue-600 dark:text-blue-400">&quot;{name}&quot;: </span>}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="hover:bg-gray-100 dark:hover:bg-gray-800 px-1 rounded"
          >
            <span className="text-gray-600 dark:text-gray-400 mr-1">
              {isExpanded ? '▼' : '▶'}
            </span>
            <span>{'{'}</span>
            {!isExpanded && <span className="text-gray-500 dark:text-gray-400 ml-1">{keys.length} keys</span>}
            {(!isExpanded || isEmpty) && <span>{'}'}</span>}
          </button>
        </div>
        {isExpanded && !isEmpty && (
          <div className="ml-4 border-l border-gray-300 dark:border-gray-600 pl-2">
            {keys.map((key, index) => (
              <JsonNode
                key={key}
                name={key}
                data={data[key]}
                isLast={index === keys.length - 1}
                depth={depth + 1}
                isDark={isDark}
              />
            ))}
          </div>
        )}
        {isExpanded && !isEmpty && <div>{'}'}{!isLast && ','}</div>}
      </div>
    );
  }

  return null;
}

export default function JsonViewer({ data, isDark = false, id = 'default' }: JsonViewerProps) {
  const [jsonPath, setJsonPath] = useState('');
  const [filteredData, setFilteredData] = useState(data);
  const [height, setHeight] = useState(viewerHeights[id] || 384);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  // Update filteredData when data changes
  useEffect(() => {
    if (!jsonPath.trim()) {
      setFilteredData(data);
    } else {
      handleJsonPathChange(jsonPath);
    }
  }, [data]);

  const handleJsonPathChange = (path: string) => {
    setJsonPath(path);

    if (!path.trim()) {
      setFilteredData(data);
      return;
    }

    try {
      // Simple JSONPath implementation
      const keys = path.replace(/^\$\.?/, '').split('.');
      let current: any = data;

      for (const key of keys) {
        if (key === '') continue;

        // Handle array index
        const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
        if (arrayMatch) {
          const [, objKey, index] = arrayMatch;
          current = current[objKey][parseInt(index)];
        } else {
          current = current[key];
        }

        if (current === undefined) {
          setFilteredData({ error: 'Path not found' });
          return;
        }
      }

      setFilteredData(current);
    } catch (e) {
      setFilteredData({ error: 'Invalid path' });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startYRef.current = e.clientY;
    startHeightRef.current = height;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const delta = e.clientY - startYRef.current;
      const newHeight = Math.max(200, Math.min(1200, startHeightRef.current + delta));
      setHeight(newHeight);

      // Save to memory
      viewerHeights[id] = newHeight;

      // Save to localStorage
      try {
        localStorage.setItem('jsonViewerHeights', JSON.stringify(viewerHeights));
      } catch (e) {
        console.error('Error saving viewer heights:', e);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, height]);

  return (
    <div className="space-y-2">
      <div>
        <input
          type="text"
          placeholder="JSONPath filter (e.g., events[0].data)"
          value={jsonPath}
          onChange={(e) => handleJsonPathChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-sm font-mono"
        />
      </div>
      <div className="relative">
        <div
          ref={containerRef}
          className="border border-gray-300 dark:border-gray-600 rounded-md overflow-auto p-3 bg-white dark:bg-gray-900 font-mono text-sm"
          style={{ height: `${height}px` }}
        >
          <JsonNode data={filteredData} isDark={isDark} />
        </div>
        {/* Resize Handle */}
        <div
          className={`absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-blue-500/20 transition-colors ${
            isResizing ? 'bg-blue-500/30' : ''
          }`}
          onMouseDown={handleMouseDown}
        >
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-gray-400 dark:bg-gray-600 rounded-full" />
        </div>
      </div>
    </div>
  );
}
