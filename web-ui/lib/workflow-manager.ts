/**
 * Development Workflow Manager
 * Automates common TrinityCore development tasks
 */

export interface WorkflowTask {
  id: string;
  name: string;
  description: string;
  category: 'database' | 'server' | 'code-gen' | 'testing' | 'deployment';
  status: 'idle' | 'running' | 'success' | 'error';
  progress?: number;
  output?: string[];
  error?: string;
  startTime?: Date;
  endTime?: Date;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tasks: Array<{
    name: string;
    command: string;
    args?: string[];
  }>;
}

/**
 * Predefined workflow templates
 */
export const WorkflowTemplates: WorkflowTemplate[] = [
  {
    id: 'db-reset',
    name: 'Reset Database',
    description: 'Drop and recreate database from SQL files',
    category: 'database',
    tasks: [
      { name: 'Backup current database', command: 'mysqldump', args: ['world', '>', 'backup.sql'] },
      { name: 'Drop database', command: 'mysql', args: ['-e', 'DROP DATABASE IF EXISTS world'] },
      { name: 'Create database', command: 'mysql', args: ['-e', 'CREATE DATABASE world'] },
      { name: 'Import base SQL', command: 'mysql', args: ['world', '<', 'sql/base/world.sql'] },
      { name: 'Apply updates', command: 'mysql', args: ['world', '<', 'sql/updates/world/*.sql'] },
    ],
  },
  {
    id: 'db-update',
    name: 'Apply Database Updates',
    description: 'Apply pending SQL update files',
    category: 'database',
    tasks: [
      { name: 'Find pending updates', command: 'find', args: ['sql/updates', '-name', '*.sql'] },
      { name: 'Apply updates', command: 'mysql', args: ['world', '<', 'sql/updates/world/*.sql'] },
      { name: 'Verify schema', command: 'mysql', args: ['-e', 'SHOW TABLES FROM world'] },
    ],
  },
  {
    id: 'server-start',
    name: 'Start Worldserver',
    description: 'Start TrinityCore worldserver with custom config',
    category: 'server',
    tasks: [
      { name: 'Check if running', command: 'pgrep', args: ['worldserver'] },
      { name: 'Start worldserver', command: './worldserver', args: ['-c', 'worldserver.conf'] },
      { name: 'Wait for startup', command: 'sleep', args: ['5'] },
      { name: 'Verify process', command: 'pgrep', args: ['worldserver'] },
    ],
  },
  {
    id: 'server-restart',
    name: 'Restart Worldserver',
    description: 'Gracefully restart worldserver',
    category: 'server',
    tasks: [
      { name: 'Send shutdown signal', command: 'pkill', args: ['-SIGTERM', 'worldserver'] },
      { name: 'Wait for shutdown', command: 'sleep', args: ['10'] },
      { name: 'Force kill if needed', command: 'pkill', args: ['-9', 'worldserver'] },
      { name: 'Start worldserver', command: './worldserver', args: ['-c', 'worldserver.conf'] },
      { name: 'Verify startup', command: 'pgrep', args: ['worldserver'] },
    ],
  },
  {
    id: 'generate-creature-script',
    name: 'Generate Creature Script',
    description: 'Generate C++ script skeleton for custom creature',
    category: 'code-gen',
    tasks: [
      { name: 'Read creature template', command: 'mysql', args: ['-e', 'SELECT * FROM creature_template'] },
      { name: 'Generate .cpp file', command: 'generate-script', args: ['creature', '--output', 'src/scripts/custom/'] },
      { name: 'Add to CMakeLists', command: 'echo', args: ['custom_creature.cpp', '>>', 'CMakeLists.txt'] },
    ],
  },
  {
    id: 'run-tests',
    name: 'Run Unit Tests',
    description: 'Compile and run TrinityCore unit tests',
    category: 'testing',
    tasks: [
      { name: 'Build tests', command: 'cmake', args: ['--build', 'build', '--target', 'tests'] },
      { name: 'Run all tests', command: 'ctest', args: ['--output-on-failure'] },
      { name: 'Generate coverage', command: 'gcov', args: ['build/tests/*.gcda'] },
    ],
  },
  {
    id: 'extract-dbc',
    name: 'Extract DBC Files',
    description: 'Extract DBC/DB2 files from game client',
    category: 'deployment',
    tasks: [
      { name: 'Extract DBC', command: './mapextractor', args: ['-d', 'dbc'] },
      { name: 'Extract maps', command: './mapextractor', args: ['-d', 'maps'] },
      { name: 'Extract vmaps', command: './vmap4extractor' },
      { name: 'Assemble vmaps', command: './vmap4assembler' },
    ],
  },
  {
    id: 'deploy-updates',
    name: 'Deploy to Production',
    description: 'Deploy code and database updates to production server',
    category: 'deployment',
    tasks: [
      { name: 'Run tests', command: 'ctest' },
      { name: 'Build release', command: 'cmake', args: ['--build', 'build', '--config', 'Release'] },
      { name: 'Backup production DB', command: 'mysqldump', args: ['world', '>', 'prod_backup.sql'] },
      { name: 'Apply DB updates', command: 'mysql', args: ['world', '<', 'sql/updates/world/*.sql'] },
      { name: 'Copy binaries', command: 'rsync', args: ['-avz', 'build/bin/', 'user@prod:/opt/trinitycore/'] },
      { name: 'Restart server', command: 'ssh', args: ['user@prod', 'systemctl restart trinitycore'] },
    ],
  },
];

/**
 * Create a new workflow task
 */
export function createTask(
  name: string,
  description: string,
  category: WorkflowTask['category']
): WorkflowTask {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `task-${Date.now()}`,
    name,
    description,
    category,
    status: 'idle',
    output: [],
  };
}

/**
 * Update task status
 */
export function updateTaskStatus(
  task: WorkflowTask,
  status: WorkflowTask['status'],
  options?: {
    progress?: number;
    output?: string;
    error?: string;
  }
): WorkflowTask {
  const updated: WorkflowTask = {
    ...task,
    status,
  };

  if (status === 'running' && !task.startTime) {
    updated.startTime = new Date();
  }

  if ((status === 'success' || status === 'error') && !task.endTime) {
    updated.endTime = new Date();
  }

  if (options?.progress !== undefined) {
    updated.progress = options.progress;
  }

  if (options?.output) {
    updated.output = [...(task.output || []), options.output];
  }

  if (options?.error) {
    updated.error = options.error;
  }

  return updated;
}

/**
 * Calculate task duration
 */
export function getTaskDuration(task: WorkflowTask): string {
  if (!task.startTime) return '-';

  const endTime = task.endTime || new Date();
  const durationMs = endTime.getTime() - task.startTime.getTime();

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  } else if (durationMs < 60000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Execute workflow template
 */
export async function executeWorkflow(
  template: WorkflowTemplate,
  onProgress: (taskIndex: number, task: WorkflowTask) => void
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  for (let i = 0; i < template.tasks.length; i++) {
    const taskDef = template.tasks[i];
    let task = createTask(taskDef.name, '', template.category as any);

    // Start task
    task = updateTaskStatus(task, 'running', { progress: 0 });
    onProgress(i, task);

    try {
      // Simulate task execution
      // In real implementation, this would execute the actual command
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Success
      task = updateTaskStatus(task, 'success', { progress: 100, output: `Executed: ${taskDef.command} ${taskDef.args?.join(' ') || ''}` });
      onProgress(i, task);
    } catch (error: any) {
      // Error
      task = updateTaskStatus(task, 'error', { error: error.message });
      onProgress(i, task);
      errors.push(`${taskDef.name}: ${error.message}`);

      // Stop on error
      break;
    }
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

/**
 * Get workflow status summary
 */
export function getWorkflowSummary(tasks: WorkflowTask[]): {
  total: number;
  idle: number;
  running: number;
  success: number;
  error: number;
  progress: number;
} {
  const summary = {
    total: tasks.length,
    idle: 0,
    running: 0,
    success: 0,
    error: 0,
    progress: 0,
  };

  for (const task of tasks) {
    summary[task.status]++;

    if (task.status === 'success') {
      summary.progress += 100;
    } else if (task.status === 'running' && task.progress) {
      summary.progress += task.progress;
    }
  }

  if (summary.total > 0) {
    summary.progress = Math.round(summary.progress / summary.total);
  }

  return summary;
}

/**
 * Generate C++ creature script skeleton
 */
export function generateCreatureScript(creatureName: string, creatureEntry: number): string {
  const className = `npc_${creatureName.toLowerCase().replace(/\s+/g, '_')}`;

  return `/*
 * Copyright (C) ${new Date().getFullYear()} TrinityCore <http://www.trinitycore.org/>
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 2 of the License, or (at your
 * option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

#include "ScriptMgr.h"
#include "ScriptedCreature.h"

enum Spells
{
    // TODO: Add spell IDs
};

enum Events
{
    // TODO: Add event IDs
};

enum Texts
{
    // TODO: Add text IDs
};

struct ${className} : public ScriptedAI
{
    ${className}(Creature* creature) : ScriptedAI(creature) { }

    void Reset() override
    {
        _events.Reset();
        // TODO: Reset logic
    }

    void JustEngagedWith(Unit* who) override
    {
        // TODO: Combat start logic
    }

    void JustDied(Unit* killer) override
    {
        // TODO: Death logic
    }

    void UpdateAI(uint32 diff) override
    {
        if (!UpdateVictim())
            return;

        _events.Update(diff);

        if (me->HasUnitState(UNIT_STATE_CASTING))
            return;

        while (uint32 eventId = _events.ExecuteEvent())
        {
            switch (eventId)
            {
                // TODO: Handle events
                default:
                    break;
            }
        }

        DoMeleeAttackIfReady();
    }

private:
    EventMap _events;
};

void Add${className.replace(/^npc_/, '')}Scripts()
{
    RegisterCreatureAI(${className});
}
`;
}

/**
 * Generate SQL INSERT statement for spell
 */
export function generateSpellSQL(spellId: number, spellName: string): string {
  return `-- ${spellName} (${spellId})
INSERT INTO spell_dbc (
    Id, SpellName, Rank, Description, ToolTip,
    SchoolMask, DmgClass, PreventionType, Attributes,
    AttributesEx, AttributesEx2, AttributesEx3
) VALUES (
    ${spellId}, '${spellName}', '', '', '',
    1, 0, 0, 0,
    0, 0, 0
);

-- Script binding
INSERT INTO spell_script_names (spell_id, ScriptName)
VALUES (${spellId}, 'spell_${spellName.toLowerCase().replace(/\s+/g, '_')}');
`;
}

/**
 * Format SQL for display
 */
export function formatSQL(sql: string): string {
  return sql
    .replace(/INSERT INTO/gi, '\nINSERT INTO')
    .replace(/VALUES/gi, '\nVALUES')
    .replace(/SELECT/gi, '\nSELECT')
    .replace(/FROM/gi, '\nFROM')
    .replace(/WHERE/gi, '\nWHERE')
    .replace(/ORDER BY/gi, '\nORDER BY')
    .replace(/GROUP BY/gi, '\nGROUP BY');
}
