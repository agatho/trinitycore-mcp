"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Zap,
  ShoppingBag,
  Users,
  FileCode,
  BookOpen,
  Settings,
  BarChart3,
  Activity,
  Database,
  Globe,
  Layers,
  GitBranch,
  Menu,
  X,
  Home,
  Search,
} from "lucide-react";
import { GlobalSearch } from "./GlobalSearch";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  category?: string;
}

const navigation: NavItem[] = [
  // Core Features
  { label: "Home", href: "/", icon: <Home className="w-4 h-4" />, category: "core" },
  { label: "Dashboard", href: "/dashboard", icon: <BarChart3 className="w-4 h-4" />, category: "core" },
  { label: "Playground", href: "/playground", icon: <FileCode className="w-4 h-4" />, category: "core" },
  { label: "Documentation", href: "/docs", icon: <BookOpen className="w-4 h-4" />, category: "core" },

  // Data Exploration
  { label: "Spells", href: "/spells", icon: <Zap className="w-4 h-4" />, category: "data" },
  { label: "Items", href: "/items", icon: <ShoppingBag className="w-4 h-4" />, category: "data" },
  { label: "Creatures", href: "/creatures", icon: <Users className="w-4 h-4" />, category: "data" },
  { label: "Quest Chains", href: "/quest-chains", icon: <GitBranch className="w-4 h-4" />, category: "data" },

  // Development Tools
  { label: "Schema Explorer", href: "/schema-explorer", icon: <Database className="w-4 h-4" />, category: "tools" },
  { label: "AI Visualizer", href: "/ai-visualizer", icon: <Activity className="w-4 h-4" />, category: "tools" },
  { label: "SAI Editor", href: "/sai-editor", icon: <FileCode className="w-4 h-4" />, category: "tools" },
  { label: "Map Picker", href: "/map-picker", icon: <Globe className="w-4 h-4" />, category: "tools" },
  { label: "3D Viewer", href: "/3d-viewer", icon: <Layers className="w-4 h-4" />, category: "tools" },

  // System
  { label: "Monitoring", href: "/monitoring", icon: <Activity className="w-4 h-4" />, category: "system" },
  { label: "Settings", href: "/settings", icon: <Settings className="w-4 h-4" />, category: "system" },
];

const navCategories = {
  core: "Core Features",
  data: "Data Exploration",
  tools: "Development Tools",
  system: "System",
};

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-700/50 bg-slate-900/95 backdrop-blur supports-[backdrop-filter]:bg-slate-900/75">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo / Brand */}
          <Link
            href="/"
            className="flex items-center gap-3 text-white hover:text-slate-300 transition-colors"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <div className="text-lg font-semibold">TrinityCore API</div>
              <div className="text-xs text-slate-400 -mt-1">MCP Explorer</div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {navigation.filter(item => item.category === "core").map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-slate-800 text-white"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/50"
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}

            {/* Data Dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors">
                <Database className="w-4 h-4" />
                <span>Data</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              <div className="absolute left-0 mt-2 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform group-hover:translate-y-0 translate-y-2">
                <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                  {navigation.filter(item => item.category === "data").map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                        isActive(item.href)
                          ? "bg-slate-700 text-white"
                          : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                      )}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Tools Dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors">
                <Layers className="w-4 h-4" />
                <span>Tools</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              <div className="absolute left-0 mt-2 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform group-hover:translate-y-0 translate-y-2">
                <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                  {navigation.filter(item => item.category === "tools").map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                        isActive(item.href)
                          ? "bg-slate-700 text-white"
                          : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                      )}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {/* Global Search */}
            <div className="hidden md:block">
              <GlobalSearch />
            </div>

            {/* Settings Link (Desktop) */}
            <Link
              href="/settings"
              className={cn(
                "hidden lg:flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive("/settings")
                  ? "bg-slate-800 text-white"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/50"
              )}
            >
              <Settings className="w-4 h-4" />
            </Link>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-slate-300 hover:text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-700/50 bg-slate-900">
          <div className="container mx-auto px-4 py-4 space-y-1 max-h-[calc(100vh-4rem)] overflow-y-auto">
            {/* Mobile Search */}
            <div className="md:hidden mb-4">
              <GlobalSearch />
            </div>

            {/* Navigation by Category */}
            {Object.entries(navCategories).map(([category, label]) => (
              <div key={category} className="py-2">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
                  {label}
                </div>
                {navigation.filter(item => item.category === category).map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive(item.href)
                        ? "bg-slate-800 text-white"
                        : "text-slate-300 hover:text-white hover:bg-slate-800/50"
                    )}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
