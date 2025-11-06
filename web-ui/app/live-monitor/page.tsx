/**
 * Live Monitor Page
 *
 * Page for real-time TrinityCore SOAP event monitoring.
 *
 * @module live-monitor/page
 */

"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";

// Dynamic import to avoid SSR issues
const LiveMonitorDashboard = dynamic(
  () => import("@/components/live-monitor/LiveMonitorDashboard"),
  { ssr: false },
);

export default function LiveMonitorPage() {
  const [url, setUrl] = useState("ws://localhost:3000/ws/soap-events");
  const [authToken, setAuthToken] = useState("");
  const [connected, setConnected] = useState(false);

  const handleConnect = () => {
    if (!url) {
      alert("Please enter a WebSocket URL");
      return;
    }
    setConnected(true);
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center">
        <div className="max-w-md w-full p-8 bg-gray-800 rounded-lg shadow-lg">
          <h1 className="text-3xl font-bold mb-6">Live Event Monitor</h1>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">WebSocket URL</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="ws://localhost:3000/ws/soap-events"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
              />
              <div className="text-xs text-gray-400 mt-1">
                Enter the WebSocket server URL for SOAP events
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Authentication Token (Optional)
              </label>
              <input
                type="password"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder="Leave blank if not required"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
              />
            </div>

            <button
              onClick={handleConnect}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded font-semibold"
            >
              Connect
            </button>
          </div>

          <div className="mt-6 p-4 bg-gray-900 rounded text-xs">
            <h3 className="font-semibold mb-2">Features:</h3>
            <ul className="space-y-1 text-gray-400">
              <li>• Real-time SOAP event streaming</li>
              <li>• Event filtering by type and text</li>
              <li>• Pause/resume event stream</li>
              <li>• Export events to JSON</li>
              <li>• Auto-reconnect on disconnect</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return <LiveMonitorDashboard url={url} authToken={authToken} />;
}
