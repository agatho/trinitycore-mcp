/**
 * Bot AI Behavior Analyzer
 *
 * Purpose: Analyze PlayerBot C++ AI code and visualize decision-making logic
 *
 * Features:
 * - Parse C++ bot AI files
 * - Extract decision trees (if/else, switch statements)
 * - Identify action priorities
 * - Detect unreachable code paths
 * - Generate visual flowcharts
 * - Suggest optimization opportunities
 *
 * @module tools/botaianalyzer
 */

import * as fs from "fs/promises";
import * as path from "path";

export interface AIDecisionNode {
    type: "condition" | "action" | "switch" | "loop";
    line: number;
    condition?: string;
    action?: string;
    priority?: number;
    children?: AIDecisionNode[];
    unreachable?: boolean;
}

export interface ActionPriority {
    action: string;
    priority: number;
    condition: string;
    line: number;
    spellId?: number;
}

export interface AIAnalysisReport {
    file: string;
    className: string;
    totalLines: number;
    decisionPoints: number;
    actionCount: number;
    priorities: ActionPriority[];
    decisionTree: AIDecisionNode[];
    issues: AIIssue[];
    flowchart: string;  // Mermaid diagram
    optimization: OptimizationSuggestion[];
}

export interface AIIssue {
    type: "unreachable-code" | "missing-cooldown-check" | "performance" | "logic-error" | "missing-null-check";
    severity: "critical" | "high" | "medium" | "low";
    line: number;
    code: string;
    description: string;
    suggestion: string;
}

export interface OptimizationSuggestion {
    type: "reorder-priorities" | "cache-result" | "combine-conditions" | "extract-function";
    impact: "high" | "medium" | "low";
    description: string;
    before: string;
    after: string;
    estimatedImprovement: string;
}

/**
 * Analyze bot AI behavior from C++ source file
 */
export async function analyzeBotAI(options: {
    filePath: string;
    outputFormat?: "json" | "markdown" | "flowchart";
    detectIssues?: boolean;
    generateOptimizations?: boolean;
}): Promise<AIAnalysisReport> {
    const { filePath, outputFormat = "markdown", detectIssues = true, generateOptimizations = true } = options;

    // Read file
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n");

    // Extract class name
    const className = extractClassName(content);

    // Parse decision tree
    const decisionTree = parseDecisionTree(content, lines);

    // Extract action priorities
    const priorities = extractActionPriorities(content, lines);

    // Count decision points and actions
    const decisionPoints = countDecisionPoints(decisionTree);
    const actionCount = priorities.length;

    // Detect issues
    const issues: AIIssue[] = detectIssues ? analyzeIssues(content, lines, decisionTree) : [];

    // Generate optimizations
    const optimization: OptimizationSuggestion[] = generateOptimizations ?
        generateOptimizationSuggestions(content, lines, decisionTree, priorities) : [];

    // Generate flowchart
    const flowchart = generateMermaidFlowchart(decisionTree, priorities);

    return {
        file: path.basename(filePath),
        className,
        totalLines: lines.length,
        decisionPoints,
        actionCount,
        priorities,
        decisionTree,
        issues,
        flowchart,
        optimization,
    };
}

/**
 * Format analysis report based on output format
 */
export async function formatAIAnalysisReport(
    report: AIAnalysisReport,
    format: "json" | "markdown" | "flowchart"
): Promise<string> {
    if (format === "json") {
        return JSON.stringify(report, null, 2);
    }

    if (format === "flowchart") {
        return report.flowchart;
    }

    // Markdown format
    let md = `# Bot AI Analysis: ${report.className}\n\n`;
    md += `**File:** \`${report.file}\`\n`;
    md += `**Total Lines:** ${report.totalLines}\n`;
    md += `**Decision Points:** ${report.decisionPoints}\n`;
    md += `**Actions:** ${report.actionCount}\n\n`;

    // Action priorities
    if (report.priorities.length > 0) {
        md += `## Action Priorities\n\n`;
        md += `| Priority | Action | Condition | Line |\n`;
        md += `|----------|--------|-----------|------|\n`;

        const sortedPriorities = report.priorities.sort((a, b) => b.priority - a.priority);
        for (const priority of sortedPriorities.slice(0, 10)) {
            md += `| ${priority.priority} | ${priority.action} | ${priority.condition.substring(0, 40)}... | ${priority.line} |\n`;
        }
        md += `\n`;
    }

    // Issues
    if (report.issues.length > 0) {
        md += `## Issues Found (${report.issues.length})\n\n`;

        const criticalIssues = report.issues.filter(i => i.severity === "critical");
        const highIssues = report.issues.filter(i => i.severity === "high");

        if (criticalIssues.length > 0) {
            md += `### 🔴 Critical Issues (${criticalIssues.length})\n\n`;
            for (const issue of criticalIssues) {
                md += `**Line ${issue.line}:** ${issue.description}\n`;
                md += `\`\`\`cpp\n${issue.code}\n\`\`\`\n`;
                md += `**Suggestion:** ${issue.suggestion}\n\n`;
            }
        }

        if (highIssues.length > 0) {
            md += `### 🟠 High Priority Issues (${highIssues.length})\n\n`;
            for (const issue of highIssues.slice(0, 5)) {
                md += `**Line ${issue.line}:** ${issue.description}\n`;
                md += `**Suggestion:** ${issue.suggestion}\n\n`;
            }
        }
    }

    // Optimizations
    if (report.optimization.length > 0) {
        md += `## Optimization Suggestions (${report.optimization.length})\n\n`;

        const highImpact = report.optimization.filter(o => o.impact === "high");
        for (const opt of highImpact.slice(0, 3)) {
            md += `### ${opt.type} (${opt.impact} impact)\n\n`;
            md += `${opt.description}\n\n`;
            md += `**Before:**\n\`\`\`cpp\n${opt.before}\n\`\`\`\n\n`;
            md += `**After:**\n\`\`\`cpp\n${opt.after}\n\`\`\`\n\n`;
            md += `**Estimated Improvement:** ${opt.estimatedImprovement}\n\n`;
        }
    }

    // Flowchart
    md += `## AI Decision Flow\n\n`;
    md += `\`\`\`mermaid\n${report.flowchart}\n\`\`\`\n\n`;

    return md;
}

/**
 * Extract class name from C++ file
 */
function extractClassName(content: string): string {
    const classMatch = content.match(/class\s+([A-Za-z0-9_]+)\s*:/);
    if (classMatch) {
        return classMatch[1];
    }
    return "Unknown";
}

/**
 * Parse decision tree from C++ code
 */
function parseDecisionTree(content: string, lines: string[]): AIDecisionNode[] {
    const tree: AIDecisionNode[] = [];
    let currentLevel = 0;
    const stack: AIDecisionNode[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const lineNum = i + 1;

        // Detect if statements
        if (line.startsWith("if (") || line.includes("if (")) {
            const condition = extractCondition(line);
            const node: AIDecisionNode = {
                type: "condition",
                line: lineNum,
                condition,
                children: [],
            };

            if (stack.length === 0) {
                tree.push(node);
            } else {
                stack[stack.length - 1].children!.push(node);
            }
            stack.push(node);
        }

        // Detect action calls
        else if (line.includes("DoCast") || line.includes("return")) {
            const action = extractAction(line);
            const node: AIDecisionNode = {
                type: "action",
                line: lineNum,
                action,
            };

            if (stack.length > 0) {
                stack[stack.length - 1].children!.push(node);
            } else {
                tree.push(node);
            }
        }

        // Detect closing braces (pop stack)
        else if (line === "}") {
            if (stack.length > 0) {
                stack.pop();
            }
        }
    }

    return tree;
}

/**
 * Extract condition from if statement
 */
function extractCondition(line: string): string {
    const match = line.match(/if\s*\((.*)\)/);
    if (match) {
        return match[1].trim();
    }
    return line;
}

/**
 * Extract action from code line
 */
function extractAction(line: string): string {
    // Extract function call
    const castMatch = line.match(/DoCast\(([^)]+)\)/);
    if (castMatch) {
        return `Cast: ${castMatch[1]}`;
    }

    const returnMatch = line.match(/return\s+(.+);/);
    if (returnMatch) {
        return `Return: ${returnMatch[1]}`;
    }

    return line.substring(0, 50);
}

/**
 * Extract action priorities from comments and code structure
 */
function extractActionPriorities(content: string, lines: string[]): ActionPriority[] {
    const priorities: ActionPriority[] = [];
    let currentPriority = 100;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        // Look for priority comments
        const priorityMatch = line.match(/\/\/.*[Pp]riority[:\s]+(\d+)/);
        if (priorityMatch) {
            currentPriority = parseInt(priorityMatch[1]);
        }

        // Look for phase comments
        const phaseMatch = line.match(/\/\/.*[Pp]hase\s+(\d+)/);
        if (phaseMatch) {
            currentPriority = 100 - (parseInt(phaseMatch[1]) * 10);
        }

        // Extract actions with their conditions
        if (line.includes("DoCast") || line.includes("CastSpell")) {
            const action = extractAction(line);
            const condition = getPreviousCondition(lines, i);

            priorities.push({
                action,
                priority: currentPriority,
                condition: condition || "Always",
                line: lineNum,
            });

            currentPriority -= 1;  // Auto-decrement for sequential actions
        }
    }

    return priorities;
}

/**
 * Get the condition from previous if statement
 */
function getPreviousCondition(lines: string[], currentIndex: number): string | null {
    for (let i = currentIndex - 1; i >= Math.max(0, currentIndex - 10); i--) {
        const line = lines[i].trim();
        if (line.startsWith("if (")) {
            return extractCondition(line);
        }
    }
    return null;
}

/**
 * Count total decision points in tree
 */
function countDecisionPoints(tree: AIDecisionNode[]): number {
    let count = 0;

    function traverse(nodes: AIDecisionNode[]) {
        for (const node of nodes) {
            if (node.type === "condition") {
                count++;
            }
            if (node.children) {
                traverse(node.children);
            }
        }
    }

    traverse(tree);
    return count;
}

/**
 * Analyze code for issues
 */
function analyzeIssues(content: string, lines: string[], tree: AIDecisionNode[]): AIIssue[] {
    const issues: AIIssue[] = [];

    // Check for missing cooldown checks
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        if (line.includes("DoCast") || line.includes("CastSpell")) {
            // Check if there's a cooldown check within 5 lines above
            const hasCooldownCheck = checkForCooldownCheck(lines, i, 5);
            if (!hasCooldownCheck) {
                issues.push({
                    type: "missing-cooldown-check",
                    severity: "medium",
                    line: lineNum,
                    code: line.trim(),
                    description: "Spell cast without cooldown check",
                    suggestion: "Add CanCast() or cooldown check before casting",
                });
            }
        }

        // Check for missing null checks on pointers
        if (line.includes("->") && !line.includes("if (")) {
            const prevLine = i > 0 ? lines[i - 1] : "";
            if (!prevLine.includes("if (") && !prevLine.includes("ASSERT")) {
                issues.push({
                    type: "missing-null-check",
                    severity: "high",
                    line: lineNum,
                    code: line.trim(),
                    description: "Pointer dereference without null check",
                    suggestion: "Add null check before dereferencing pointer",
                });
            }
        }
    }

    // Detect unreachable code
    const unreachableNodes = findUnreachableCode(tree);
    for (const node of unreachableNodes) {
        issues.push({
            type: "unreachable-code",
            severity: "low",
            line: node.line,
            code: node.action || node.condition || "",
            description: "This code path is never executed",
            suggestion: "Remove or fix the condition logic",
        });
    }

    return issues;
}

/**
 * Check for cooldown check in previous lines
 */
function checkForCooldownCheck(lines: string[], currentIndex: number, lookback: number): boolean {
    for (let i = currentIndex - 1; i >= Math.max(0, currentIndex - lookback); i--) {
        const line = lines[i];
        if (line.includes("CanCast") || line.includes("IsReady") || line.includes("GetCooldown")) {
            return true;
        }
    }
    return false;
}

/**
 * Find unreachable code nodes
 */
function findUnreachableCode(tree: AIDecisionNode[]): AIDecisionNode[] {
    const unreachable: AIDecisionNode[] = [];

    function traverse(nodes: AIDecisionNode[], parentCondition: string | null = null) {
        for (const node of nodes) {
            // Check for contradictory conditions
            if (node.type === "condition" && parentCondition) {
                if (isContradictory(parentCondition, node.condition || "")) {
                    node.unreachable = true;
                    unreachable.push(node);
                }
            }

            if (node.children) {
                traverse(node.children, node.condition || parentCondition);
            }
        }
    }

    traverse(tree);
    return unreachable;
}

/**
 * Check if two conditions are contradictory
 */
function isContradictory(condition1: string, condition2: string): boolean {
    // Simple contradiction detection
    if (condition1.includes("< 20") && condition2.includes("> 50")) {
        return true;
    }
    if (condition1.includes("== true") && condition2.includes("== false")) {
        return true;
    }
    return false;
}

/**
 * Generate optimization suggestions
 */
function generateOptimizationSuggestions(
    content: string,
    lines: string[],
    tree: AIDecisionNode[],
    priorities: ActionPriority[]
): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Suggest priority reordering if low-priority actions come before high-priority
    for (let i = 0; i < priorities.length - 1; i++) {
        const current = priorities[i];
        const next = priorities[i + 1];

        if (current.priority < next.priority) {
            suggestions.push({
                type: "reorder-priorities",
                impact: "high",
                description: `High-priority action (${next.priority}) appears after low-priority action (${current.priority})`,
                before: `${current.action} (priority ${current.priority})\n${next.action} (priority ${next.priority})`,
                after: `${next.action} (priority ${next.priority})\n${current.action} (priority ${current.priority})`,
                estimatedImprovement: "15-30% better decision quality",
            });
        }
    }

    // Suggest combining similar conditions
    const duplicateConditions = findDuplicateConditions(lines);
    for (const dup of duplicateConditions.slice(0, 3)) {
        suggestions.push({
            type: "combine-conditions",
            impact: "medium",
            description: `Condition "${dup.condition}" appears ${dup.count} times`,
            before: `if (${dup.condition}) { ... }\n...\nif (${dup.condition}) { ... }`,
            after: `if (${dup.condition}) {\n    // Combined logic\n}`,
            estimatedImprovement: "10-20% fewer condition checks",
        });
    }

    return suggestions;
}

/**
 * Find duplicate conditions
 */
function findDuplicateConditions(lines: string[]): Array<{condition: string; count: number}> {
    const conditionMap = new Map<string, number>();

    for (const line of lines) {
        if (line.trim().startsWith("if (")) {
            const condition = extractCondition(line);
            conditionMap.set(condition, (conditionMap.get(condition) || 0) + 1);
        }
    }

    return Array.from(conditionMap.entries())
        .filter(([_, count]) => count > 1)
        .map(([condition, count]) => ({ condition, count }))
        .sort((a, b) => b.count - a.count);
}

/**
 * Generate Mermaid flowchart
 */
function generateMermaidFlowchart(tree: AIDecisionNode[], priorities: ActionPriority[]): string {
    let mermaid = "graph TD\n";
    let nodeId = 0;

    function addNode(node: AIDecisionNode, parentId: number | null = null): number {
        const currentId = nodeId++;

        if (node.type === "condition") {
            mermaid += `    ${currentId}{${node.condition}}\n`;
        } else if (node.type === "action") {
            mermaid += `    ${currentId}[${node.action}]\n`;
        }

        if (parentId !== null) {
            mermaid += `    ${parentId} --> ${currentId}\n`;
        }

        if (node.children) {
            for (const child of node.children) {
                addNode(child, currentId);
            }
        }

        return currentId;
    }

    // Add start node
    mermaid += `    Start([Start Update])\n`;

    // Add top-level nodes
    for (const node of tree.slice(0, 10)) {  // Limit to first 10 nodes for readability
        const id = addNode(node, null);
        mermaid += `    Start --> ${id}\n`;
    }

    return mermaid;
}
