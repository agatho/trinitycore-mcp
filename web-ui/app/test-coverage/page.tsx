/**
 * Test Coverage Page
 *
 * Page for test coverage dashboard.
 *
 * @module test-coverage/page
 */

"use client";

import dynamic from "next/dynamic";

// Dynamic import to avoid SSR issues
const CoverageDashboard = dynamic(
  () => import("@/components/test-coverage/CoverageDashboard"),
  { ssr: false },
);

export default function TestCoveragePage() {
  return <CoverageDashboard />;
}
