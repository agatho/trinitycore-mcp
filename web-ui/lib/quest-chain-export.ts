/**
 * Quest Chain Export Utilities
 * Supports export to: JSON, PNG, SVG, Mermaid, PDF
 */

import { toPng, toSvg } from 'html-to-image';
import jsPDF from 'jspdf';

export interface Quest {
  id: number;
  title: string;
  level: number;
  prevQuestId?: number;
  nextQuestId?: number;
  zone?: string;
  zoneId?: number;
  faction?: string;
  depth: number;
}

/**
 * Export quest chain to JSON
 */
export function exportToJSON(quests: Quest[], filename: string = 'quest_chains.json') {
  const json = JSON.stringify(quests, null, 2);
  downloadFile(json, filename, 'application/json');
}

/**
 * Export ReactFlow graph to PNG
 */
export async function exportToPNG(elementId: string = '.react-flow', filename: string = 'quest_chain.png') {
  const element = document.querySelector(elementId) as HTMLElement;

  if (!element) {
    throw new Error('ReactFlow element not found');
  }

  try {
    const dataUrl = await toPng(element, {
      quality: 1.0,
      pixelRatio: 2,
      backgroundColor: '#1e293b', // slate-800
    });

    downloadFile(dataUrl, filename, 'image/png');
  } catch (error) {
    console.error('Failed to export PNG:', error);
    throw error;
  }
}

/**
 * Export ReactFlow graph to SVG
 */
export async function exportToSVG(elementId: string = '.react-flow', filename: string = 'quest_chain.svg') {
  const element = document.querySelector(elementId) as HTMLElement;

  if (!element) {
    throw new Error('ReactFlow element not found');
  }

  try {
    const dataUrl = await toSvg(element, {
      backgroundColor: '#1e293b',
    });

    downloadFile(dataUrl, filename, 'image/svg+xml');
  } catch (error) {
    console.error('Failed to export SVG:', error);
    throw error;
  }
}

/**
 * Export quest chain to Mermaid diagram format
 */
export function exportToMermaid(quests: Quest[], filename: string = 'quest_chain.mmd') {
  const mermaid = generateMermaidDiagram(quests);
  downloadFile(mermaid, filename, 'text/plain');
}

/**
 * Generate Mermaid diagram syntax from quest chain
 */
export function generateMermaidDiagram(quests: Quest[]): string {
  let diagram = 'graph LR\n';

  // Add nodes
  quests.forEach(quest => {
    const nodeId = `Q${quest.id}`;
    const label = `[${quest.level}] ${quest.title.replace(/"/g, "'")}`;

    // Determine node style based on quest properties
    const isBroken = quest.prevQuestId && !quests.find(q => q.id === quest.prevQuestId);
    const isOrphaned = !quest.prevQuestId && !quests.find(q => q.prevQuestId === quest.id);

    if (isBroken) {
      diagram += `  ${nodeId}["${label}"]:::broken\n`;
    } else if (isOrphaned) {
      diagram += `  ${nodeId}["${label}"]:::orphaned\n`;
    } else {
      diagram += `  ${nodeId}["${label}"]\n`;
    }
  });

  diagram += '\n';

  // Add edges
  quests.forEach(quest => {
    if (quest.prevQuestId) {
      const sourceId = `Q${quest.prevQuestId}`;
      const targetId = `Q${quest.id}`;
      diagram += `  ${sourceId} --> ${targetId}\n`;
    }
  });

  diagram += '\n';

  // Add styles
  diagram += '  classDef broken fill:#ef4444,stroke:#fff,color:#fff\n';
  diagram += '  classDef orphaned fill:#f59e0b,stroke:#fff,color:#fff\n';

  return diagram;
}

/**
 * Export quest chain to PDF
 */
export async function exportToPDF(elementId: string = '.react-flow', filename: string = 'quest_chain.pdf', quests: Quest[]) {
  try {
    // First export to PNG
    const element = document.querySelector(elementId) as HTMLElement;

    if (!element) {
      throw new Error('ReactFlow element not found');
    }

    const imgData = await toPng(element, {
      quality: 1.0,
      pixelRatio: 2,
      backgroundColor: '#1e293b',
    });

    // Create PDF
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Add title
    pdf.setFontSize(20);
    pdf.text('Quest Chain Visualizer', 20, 30);

    // Add metadata
    pdf.setFontSize(10);
    pdf.text(`Total Quests: ${quests.length}`, 20, 50);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, 20, 60);

    // Add image
    const img = new Image();
    img.src = imgData;

    await new Promise<void>((resolve) => {
      img.onload = () => {
        const imgWidth = pageWidth - 40;
        const imgHeight = (img.height * imgWidth) / img.width;

        pdf.addImage(imgData, 'PNG', 20, 80, imgWidth, Math.min(imgHeight, pageHeight - 100));

        // Add quest list on new page
        pdf.addPage();
        pdf.setFontSize(16);
        pdf.text('Quest List', 20, 30);

        pdf.setFontSize(10);
        let y = 50;
        quests.forEach((quest, idx) => {
          if (y > pageHeight - 40) {
            pdf.addPage();
            y = 30;
          }

          const text = `${idx + 1}. [${quest.level}] ${quest.title} (ID: ${quest.id})`;
          pdf.text(text, 20, y);
          y += 15;

          if (quest.zone) {
            pdf.setFontSize(8);
            pdf.text(`   Zone: ${quest.zone}`, 30, y);
            y += 12;
            pdf.setFontSize(10);
          }
        });

        resolve();
      };
    });

    // Save PDF
    pdf.save(filename);
  } catch (error) {
    console.error('Failed to export PDF:', error);
    throw error;
  }
}

/**
 * Export quest chain with statistics
 */
export function exportWithStats(quests: Quest[], filename: string = 'quest_chain_report.json') {
  const stats = calculateQuestChainStats(quests);

  const report = {
    metadata: {
      exportDate: new Date().toISOString(),
      totalQuests: quests.length,
    },
    statistics: stats,
    quests: quests,
  };

  const json = JSON.stringify(report, null, 2);
  downloadFile(json, filename, 'application/json');
}

/**
 * Calculate quest chain statistics
 */
export function calculateQuestChainStats(quests: Quest[]) {
  const chains: Record<number, number> = {};

  quests.forEach(quest => {
    let depth = 0;
    let current = quest;
    const visited = new Set<number>();

    while (current.prevQuestId && !visited.has(current.id)) {
      visited.add(current.id);
      const prev = quests.find(q => q.id === current.prevQuestId);
      if (!prev) break;
      depth++;
      current = prev;
    }

    chains[quest.id] = depth + 1;
  });

  const longestChain = quests.length > 0 ? Math.max(...Object.values(chains)) : 0;
  const avgChain = Object.values(chains).length > 0
    ? Object.values(chains).reduce((a, b) => a + b, 0) / Object.values(chains).length
    : 0;
  const orphaned = quests.filter(q => !q.prevQuestId && !quests.find(o => o.prevQuestId === q.id)).length;
  const broken = quests.filter(q =>
    (q.prevQuestId && !quests.find(o => o.id === q.prevQuestId)) ||
    (q.nextQuestId && !quests.find(o => o.id === q.nextQuestId))
  ).length;

  // Level distribution
  const levelDistribution: Record<number, number> = {};
  quests.forEach(q => {
    levelDistribution[q.level] = (levelDistribution[q.level] || 0) + 1;
  });

  // Zone distribution
  const zoneDistribution: Record<string, number> = {};
  quests.forEach(q => {
    if (q.zone) {
      zoneDistribution[q.zone] = (zoneDistribution[q.zone] || 0) + 1;
    }
  });

  return {
    totalQuests: quests.length,
    longestChain,
    averageChainLength: parseFloat(avgChain.toFixed(2)),
    orphanedQuests: orphaned,
    brokenQuests: broken,
    minLevel: quests.length > 0 ? Math.min(...quests.map(q => q.level)) : 0,
    maxLevel: quests.length > 0 ? Math.max(...quests.map(q => q.level)) : 0,
    levelDistribution,
    zoneDistribution,
  };
}

/**
 * Helper function to download file
 */
function downloadFile(data: string, filename: string, mimeType: string) {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
