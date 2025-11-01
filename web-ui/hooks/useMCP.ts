/**
 * React Hook: useMCP
 * Provides client-side interface to TrinityCore MCP tools via API routes
 */

import { useState, useCallback } from "react";
import useSWR from "swr";
import { MCPTool, MCPToolCategory } from "@/lib/mcp/client";

// Fetcher for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

/**
 * Hook to fetch all available MCP tools
 */
export function useMCPTools() {
  return useSWR<{ success: boolean; count: number; tools: MCPTool[] }>(
    "/api/mcp/tools",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );
}

/**
 * Hook to call MCP tools from client components
 */
export function useMCPTool<T = any>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<T | null>(null);

  const callTool = useCallback(async (toolName: string, args: Record<string, any> = {}) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/mcp/call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ toolName, args }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to call MCP tool");
      }

      setResult(data.result);
      return data.result as T;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    callTool,
    loading,
    error,
    result,
  };
}

/**
 * Hook to fetch spell information
 */
export function useSpell(spellId: number | null) {
  return useSWR(
    spellId ? `/api/spell/${spellId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );
}

/**
 * Hook to fetch item information
 */
export function useItem(itemId: number | null) {
  return useSWR(
    itemId ? `/api/item/${itemId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );
}

/**
 * Hook to fetch creature information
 */
export function useCreature(creatureId: number | null) {
  return useSWR(
    creatureId ? `/api/creature/${creatureId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );
}

/**
 * Hook to search for spells, items, or creatures
 */
export function useMCPSearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);

  const search = useCallback(async (query: string, type: "spell" | "item" | "creature") => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/mcp/call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          toolName: `search-${type}s`,
          args: { query },
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Search failed");
      }

      setResults(data.result || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    search,
    loading,
    error,
    results,
  };
}
