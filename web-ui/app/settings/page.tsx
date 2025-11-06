import dynamic from "next/dynamic";

/**
 * Settings Page
 *
 * Configuration interface for TrinityCore MCP.
 * Allows editing of database connections, file paths, server settings, and more.
 */

// Dynamically import the SettingsDashboard to avoid SSR issues
const SettingsDashboard = dynamic(
  () => import("@/components/settings/SettingsDashboard"),
  { ssr: false }
);

export default function SettingsPage() {
  return <SettingsDashboard />;
}
