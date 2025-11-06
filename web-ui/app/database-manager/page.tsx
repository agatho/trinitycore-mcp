/**
 * Database Manager Page
 *
 * Page for database management dashboard.
 *
 * @module database-manager/page
 */

"use client";

import dynamic from "next/dynamic";

// Dynamic import to avoid SSR issues
const DatabaseDashboard = dynamic(
  () => import("@/components/database-manager/DatabaseDashboard"),
  { ssr: false },
);

export default function DatabaseManagerPage() {
  return <DatabaseDashboard />;
}
