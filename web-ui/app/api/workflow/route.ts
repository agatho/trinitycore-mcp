import { NextRequest, NextResponse } from 'next/server';
import { WorkflowTemplates, generateCreatureScript, generateSpellSQL } from '@/lib/workflow-manager';

/**
 * GET /api/workflow - Get workflow templates and status
 * Query params:
 *   - action: 'templates' | 'status'
 *   - id: workflow ID (for action=status)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'templates';
    const id = searchParams.get('id');

    switch (action) {
      case 'templates':
        return NextResponse.json({ templates: WorkflowTemplates });

      case 'status':
        if (!id) {
          return NextResponse.json(
            { error: 'Workflow ID is required' },
            { status: 400 }
          );
        }
        return NextResponse.json(await getWorkflowStatus(id));

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Workflow API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workflow - Execute workflow or generate code
 * Body:
 *   - action: 'execute' | 'generate-creature' | 'generate-spell'
 *   - templateId: workflow template ID (for action=execute)
 *   - ...other params based on action
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'execute':
        return NextResponse.json(await executeWorkflow(body.templateId));

      case 'generate-creature':
        return NextResponse.json(
          generateCreatureCode(body.creatureName, body.creatureEntry)
        );

      case 'generate-spell':
        return NextResponse.json(
          generateSpellCode(body.spellId, body.spellName)
        );

      case 'custom-command':
        return NextResponse.json(await executeCustomCommand(body.command, body.args));

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Workflow API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get workflow execution status
 */
async function getWorkflowStatus(id: string) {
  // TODO: Call MCP tool to get actual status
  // For now, return mock status
  return {
    id,
    status: 'running',
    progress: 45,
    currentTask: 'Applying database updates',
    startTime: new Date(Date.now() - 30000).toISOString(),
    output: [
      '[✓] Backup current database',
      '[✓] Drop database',
      '[~] Create database (in progress...)',
    ],
  };
}

/**
 * Execute workflow template
 */
async function executeWorkflow(templateId: string) {
  const template = WorkflowTemplates.find((t) => t.id === templateId);

  if (!template) {
    return { error: 'Template not found' };
  }

  // TODO: Call MCP tool to execute workflow
  // For now, return mock result
  return {
    workflowId: `wf-${Date.now()}`,
    status: 'started',
    message: `Started workflow: ${template.name}`,
    estimatedDuration: `${template.tasks.length * 2}s`,
  };
}

/**
 * Generate creature script code
 */
function generateCreatureCode(creatureName: string, creatureEntry: number) {
  if (!creatureName || !creatureEntry) {
    return { error: 'Creature name and entry are required' };
  }

  const code = generateCreatureScript(creatureName, creatureEntry);
  const filename = `npc_${creatureName.toLowerCase().replace(/\s+/g, '_')}.cpp`;

  return {
    success: true,
    filename,
    code,
    message: `Generated script for ${creatureName} (${creatureEntry})`,
  };
}

/**
 * Generate spell SQL and script
 */
function generateSpellCode(spellId: number, spellName: string) {
  if (!spellId || !spellName) {
    return { error: 'Spell ID and name are required' };
  }

  const sql = generateSpellSQL(spellId, spellName);
  const scriptName = `spell_${spellName.toLowerCase().replace(/\s+/g, '_')}`;

  return {
    success: true,
    sql,
    scriptName,
    message: `Generated SQL for ${spellName} (${spellId})`,
  };
}

/**
 * Execute custom command
 */
async function executeCustomCommand(command: string, args: string[] = []) {
  if (!command) {
    return { error: 'Command is required' };
  }

  // TODO: Call MCP tool to execute command
  // For now, return mock result
  return {
    success: true,
    command: `${command} ${args.join(' ')}`,
    output: 'Command executed successfully (mock)',
    exitCode: 0,
  };
}
