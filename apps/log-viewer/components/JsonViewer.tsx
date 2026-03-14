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
// Store JSON paths for different viewers
const viewerJsonPaths: Record<string, string> = {};

// Load heights and paths from localStorage on module load
if (typeof window !== 'undefined') {
  try {
    const savedHeights = localStorage.getItem('jsonViewerHeights');
    if (savedHeights) {
      const heights = JSON.parse(savedHeights);
      Object.assign(viewerHeights, heights);
    }
    const savedPaths = localStorage.getItem('jsonViewerPaths');
    if (savedPaths) {
      const paths = JSON.parse(savedPaths);
      Object.assign(viewerJsonPaths, paths);
    }
  } catch (e) {
    console.error('Error loading viewer settings:', e);
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
    const hasNewlines = data.includes('\n');
    return (
      <div className="flex items-start">
        {name && <span className="text-blue-600 dark:text-blue-400">&quot;{name}&quot;: </span>}
        <span className={`text-orange-600 dark:text-orange-400 break-all ${hasNewlines ? 'whitespace-pre-wrap' : ''}`}>&quot;{data}&quot;</span>
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
  const [jsonPath, setJsonPath] = useState(() => viewerJsonPaths[id] || '');
  const [filteredData, setFilteredData] = useState(data);
  const [height, setHeight] = useState(viewerHeights[id] || 384);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  // Helper function to handle array slice
  const handleArraySlice = (arr: any[], sliceStr: string) => {
    // Supports slice syntax: start:end (e.g. -3: for last 3, :5 for first 5, 1:3, -5:-2)
    const sliceMatch = sliceStr.match(/^(-?\d*):(-?\d*)$/);
    if (!sliceMatch) return null;

    const [, startStr, endStr] = sliceMatch;
    let start = startStr === '' ? 0 : parseInt(startStr);
    let end = endStr === '' ? arr.length : parseInt(endStr);

    // Handle negative indices
    if (start < 0) start = Math.max(0, arr.length + start);
    if (end < 0) end = arr.length + end;

    // Clamp values
    start = Math.max(0, Math.min(arr.length, start));
    end = Math.max(0, Math.min(arr.length, end));

    return arr.slice(start, end);
  };

  // Apply a single path segment to current value, returns the resolved value
  const applySegment = (current: any, key: string): any => {
    if (key === '') return current;

    // Handle wildcard with named key like tools[*]
    const wildcardMatch = key.match(/^(\w+)\[\*\]$/);
    if (wildcardMatch) {
      const arr = current[wildcardMatch[1]];
      if (!Array.isArray(arr)) return { error: 'Not an array' };
      return arr; // return the full array; remaining segments will be mapped
    }

    // Handle standalone wildcard [*]
    if (key === '[*]') {
      if (!Array.isArray(current)) return { error: 'Not an array' };
      return current; // identity — mapping handled by caller
    }

    // Handle array slice like messages[-3:] or items[1:5]
    const sliceMatch = key.match(/^(\w+)\[(-?\d*:-?\d*)\]$/);
    if (sliceMatch) {
      const arr = current[sliceMatch[1]];
      if (!Array.isArray(arr)) return { error: 'Not an array' };
      const result = handleArraySlice(arr, sliceMatch[2]);
      return result === null ? { error: 'Invalid slice syntax' } : result;
    }

    // Handle standalone slice like [-3:]
    const standaloneSlice = key.match(/^\[(-?\d*:-?\d*)\]$/);
    if (standaloneSlice) {
      if (!Array.isArray(current)) return { error: 'Not an array' };
      const result = handleArraySlice(current, standaloneSlice[1]);
      return result === null ? { error: 'Invalid slice syntax' } : result;
    }

    // Handle array index like messages[0] or messages[-1]
    const arrayMatch = key.match(/^(\w+)\[(-?\d+)\]$/);
    if (arrayMatch) {
      const arr = current[arrayMatch[1]];
      if (!Array.isArray(arr)) return { error: 'Not an array' };
      let index = parseInt(arrayMatch[2]);
      if (index < 0) index = arr.length + index;
      return arr[index];
    }

    // Handle standalone index like [0] or [-1]
    const indexMatch = key.match(/^\[(-?\d+)\]$/);
    if (indexMatch) {
      if (!Array.isArray(current)) return { error: 'Not an array' };
      let index = parseInt(indexMatch[1]);
      if (index < 0) index = current.length + index;
      return current[index];
    }

    // Plain object key
    return current[key];
  };

  // Apply JSONPath filter to data (supports [*] wildcard)
  const applyJsonPath = (path: string, sourceData: any): any => {
    if (!path.trim()) {
      return sourceData;
    }

    try {
      const keys = path.replace(/^\$\.?/, '').split('.');

      // Find the first wildcard segment
      const wildcardIdx = keys.findIndex(k => k === '[*]' || /^\w+\[\*\]$/.test(k));

      if (wildcardIdx === -1) {
        // No wildcard — simple traversal
        let current: any = sourceData;
        for (const key of keys) {
          if (key === '') continue;
          current = applySegment(current, key);
          if (current === undefined) return { error: 'Path not found' };
          if (current && typeof current === 'object' && 'error' in current && Object.keys(current).length === 1) return current;
        }
        return current;
      }

      // Process segments before and including the wildcard to get the array
      let current: any = sourceData;
      for (let i = 0; i <= wildcardIdx; i++) {
        if (keys[i] === '') continue;
        current = applySegment(current, keys[i]);
        if (current === undefined) return { error: 'Path not found' };
        if (current && typeof current === 'object' && 'error' in current && Object.keys(current).length === 1) return current;
      }

      if (!Array.isArray(current)) return { error: 'Wildcard target is not an array' };

      // Remaining segments after the wildcard
      const remainingKeys = keys.slice(wildcardIdx + 1);

      if (remainingKeys.length === 0 || (remainingKeys.length === 1 && remainingKeys[0] === '')) {
        return current; // Nothing after wildcard, return the array itself
      }

      // Apply remaining path to each element; support nested wildcards via recursion
      const remainingPath = remainingKeys.join('.');
      const results = current.map((item: any) => applyJsonPath(remainingPath, item));

      // Filter out errors
      return results.filter((r: any) => !(r && typeof r === 'object' && 'error' in r && Object.keys(r).length === 1));
    } catch (e) {
      return { error: 'Invalid path' };
    }
  };

  // Apply multiple JSONPath filters and merge results
  const applyMultipleJsonPaths = (pathsInput: string, sourceData: any) => {
    if (!pathsInput.trim()) {
      return sourceData;
    }

    // Split by comma or newline, trim each path
    const paths = pathsInput
      .split(/[,\n]/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    if (paths.length === 0) {
      return sourceData;
    }

    // Single path - return result directly
    if (paths.length === 1) {
      return applyJsonPath(paths[0], sourceData);
    }

    // Multiple paths - merge results into an object
    const result: Record<string, any> = {};
    for (const path of paths) {
      const pathResult = applyJsonPath(path, sourceData);
      // Use the path as key (simplified)
      const key = path.replace(/^\$\.?/, '') || '$';
      result[key] = pathResult;
    }
    return result;
  };

  // Update filteredData when data changes, applying saved path
  useEffect(() => {
    const savedPath = viewerJsonPaths[id] || '';
    setJsonPath(savedPath);
    setFilteredData(applyMultipleJsonPaths(savedPath, data));
  }, [data, id]);

  const handleJsonPathChange = (path: string) => {
    setJsonPath(path);
    setFilteredData(applyMultipleJsonPaths(path, data));

    // Save to memory
    viewerJsonPaths[id] = path;

    // Save to localStorage
    try {
      localStorage.setItem('jsonViewerPaths', JSON.stringify(viewerJsonPaths));
    } catch (e) {
      console.error('Error saving viewer paths:', e);
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
          placeholder="JSONPath (e.g., messages[-1], tools[*].name, comma for multiple: model, messages[-3:])"
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
