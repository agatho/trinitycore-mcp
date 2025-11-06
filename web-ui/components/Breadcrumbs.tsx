"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface Breadcrumb {
  label: string;
  href: string;
}

const pageTitles: Record<string, string> = {
  // Core
  "dashboard": "Dashboard",
  "playground": "API Playground",
  "docs": "Documentation",
  "monitoring": "Monitoring",
  "settings": "Settings",

  // Data Exploration
  "spells": "Spells",
  "items": "Items",
  "creatures": "Creatures",
  "quest-chains": "Quest Chains",

  // Development Tools
  "schema-explorer": "Schema Explorer",
  "ai-visualizer": "AI Visualizer",
  "sai-editor": "SAI Editor",
  "sai-editor-enhanced": "SAI Editor Enhanced",
  "map-picker": "Map Picker",
  "map-picker-enhanced": "Map Picker Enhanced",
  "3d-viewer": "3D Viewer",
  "code-review": "Code Review",
  "profiler": "Performance Profiler",
  "workflow": "Workflow",
  "migrations": "Migrations",
  "docs-generator": "Docs Generator",
  "combat-log-analyzer": "Combat Log Analyzer",
  "diff-compare": "Diff Compare",
  "diff-merge": "Diff Merge",
  "database-manager": "Database Manager",
  "compare": "Compare",
  "map-viewer": "Map Viewer",
  "live-inspector": "Live Inspector",
  "live-monitor": "Live Monitor",
  "test-coverage": "Test Coverage",
};

export function Breadcrumbs() {
  const pathname = usePathname();

  // Don't show breadcrumbs on homepage
  if (!pathname || pathname === "/") {
    return null;
  }

  const paths = pathname.split("/").filter(Boolean);
  const breadcrumbs: Breadcrumb[] = [
    { label: "Home", href: "/" },
  ];

  // Build breadcrumb trail
  let currentPath = "";
  for (let i = 0; i < paths.length; i++) {
    const segment = paths[i];
    currentPath += `/${segment}`;

    // Check if this is a dynamic route (e.g., /spells/[spellId])
    const isLast = i === paths.length - 1;
    const isDynamicRoute = !isNaN(Number(segment));

    if (isDynamicRoute && isLast) {
      // For detail pages, show the ID
      breadcrumbs.push({
        label: `#${segment}`,
        href: currentPath,
      });
    } else {
      // Use the page title mapping
      const label = pageTitles[segment] || segment.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
      breadcrumbs.push({
        label,
        href: currentPath,
      });
    }
  }

  return (
    <nav aria-label="Breadcrumb" className="bg-slate-900/50 border-b border-slate-700/50">
      <div className="container mx-auto px-4 py-3">
        <ol className="flex items-center space-x-2 text-sm">
          {breadcrumbs.map((breadcrumb, index) => {
            const isLast = index === breadcrumbs.length - 1;

            return (
              <li key={breadcrumb.href} className="flex items-center">
                {index > 0 && (
                  <ChevronRight className="w-4 h-4 text-slate-600 mx-2" />
                )}

                {isLast ? (
                  <span className="font-medium text-white" aria-current="page">
                    {breadcrumb.label}
                  </span>
                ) : (
                  <Link
                    href={breadcrumb.href}
                    className={cn(
                      "flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors",
                      index === 0 && "text-blue-400 hover:text-blue-300"
                    )}
                  >
                    {index === 0 && <Home className="w-4 h-4" />}
                    <span>{breadcrumb.label}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
