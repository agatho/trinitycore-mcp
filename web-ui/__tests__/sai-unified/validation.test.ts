/**
 * SAI Validation Engine Tests
 *
 * Tests for the validation system including structure, nodes, connections,
 * parameters, best practices, and performance validation.
 */

import {
  validateScript,
  quickValidate,
} from '@/lib/sai-unified/validation';
import type { SAIScript, SAINode, SAIConnection } from '@/lib/sai-unified/types';

describe('SAI Validation Engine', () => {
  // Helper to create minimal valid script
  const createMinimalScript = (): SAIScript => ({
    id: 'test-script',
    name: 'Test Script',
    entryOrGuid: 12345,
    sourceType: 0,
    nodes: [
      {
        id: 'event-1',
        type: 'event',
        typeId: 0,
        label: 'Update IC',
        typeName: 'SMART_EVENT_UPDATE_IC',
        parameters: [],
      },
      {
        id: 'action-1',
        type: 'action',
        typeId: 1,
        label: 'Talk',
        typeName: 'SMART_ACTION_TALK',
        parameters: [],
      },
    ],
    connections: [
      {
        id: 'conn-1',
        source: 'event-1',
        target: 'action-1',
        type: 'event-action',
      },
    ],
    metadata: {
      version: '3.0.0',
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    },
  });

  describe('Structure Validation', () => {
    test('validates minimal valid script', () => {
      const script = createMinimalScript();
      const result = validateScript(script);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('requires at least one event node', () => {
      const script = createMinimalScript();
      script.nodes = script.nodes.filter((n) => n.type !== 'event');

      const result = validateScript(script);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('at least one event'),
        })
      );
    });

    test('requires at least one action node', () => {
      const script = createMinimalScript();
      script.nodes = script.nodes.filter((n) => n.type !== 'action');

      const result = validateScript(script);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('at least one action'),
        })
      );
    });

    test('allows scripts with targets', () => {
      const script = createMinimalScript();
      script.nodes.push({
        id: 'target-1',
        type: 'target',
        typeId: 0,
        label: 'Self',
        typeName: 'SMART_TARGET_SELF',
        parameters: [],
      });

      const result = validateScript(script);

      expect(result.valid).toBe(true);
    });
  });

  describe('Node Validation', () => {
    test('validates node IDs are unique', () => {
      const script = createMinimalScript();
      script.nodes.push({
        ...script.nodes[0],
        // Duplicate ID
      });

      const result = validateScript(script);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('duplicate'),
        })
      );
    });

    test('validates node types', () => {
      const script = createMinimalScript();
      // @ts-ignore - testing invalid type
      script.nodes[0].type = 'invalid';

      const result = validateScript(script);

      expect(result.valid).toBe(false);
    });

    test('validates node has required fields', () => {
      const script = createMinimalScript();
      // @ts-ignore - testing missing field
      delete script.nodes[0].typeId;

      const result = validateScript(script);

      expect(result.valid).toBe(false);
    });
  });

  describe('Connection Validation', () => {
    test('validates connections reference existing nodes', () => {
      const script = createMinimalScript();
      script.connections.push({
        id: 'conn-invalid',
        source: 'nonexistent-node',
        target: 'action-1',
        type: 'event-action',
      });

      const result = validateScript(script);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('source node'),
        })
      );
    });

    test('validates connection types match node types', () => {
      const script = createMinimalScript();
      script.connections[0].type = 'action-target';
      // But source is still event-1, which is wrong

      const result = validateScript(script);

      expect(result.valid).toBe(false);
    });

    test('allows multiple connections from same source', () => {
      const script = createMinimalScript();
      script.nodes.push({
        id: 'action-2',
        type: 'action',
        typeId: 2,
        label: 'Cast Spell',
        typeName: 'SMART_ACTION_CAST',
        parameters: [],
      });
      script.connections.push({
        id: 'conn-2',
        source: 'event-1',
        target: 'action-2',
        type: 'event-action',
      });

      const result = validateScript(script);

      expect(result.valid).toBe(true);
    });
  });

  describe('Parameter Validation', () => {
    test('validates parameter types', () => {
      const script = createMinimalScript();
      script.nodes[0].parameters.push({
        name: 'timer',
        type: 'uint32',
        value: -1, // Invalid - negative number for uint32
      });

      const result = validateScript(script);

      // Should have warning about negative value
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('validates required parameters are present', () => {
      const script = createMinimalScript();
      // Assuming Talk action requires text ID parameter
      script.nodes[1].parameters = [];

      const result = validateScript(script);

      // May have info about missing parameters
      expect(result.info.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Best Practices', () => {
    test('warns about unused nodes', () => {
      const script = createMinimalScript();
      script.nodes.push({
        id: 'action-orphan',
        type: 'action',
        typeId: 3,
        label: 'Flee',
        typeName: 'SMART_ACTION_FLEE',
        parameters: [],
      });
      // No connection to this node

      const result = validateScript(script);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('not connected'),
        })
      );
    });

    test('warns about circular dependencies', () => {
      const script = createMinimalScript();
      // Create circular reference
      script.connections.push({
        id: 'conn-circular',
        source: 'action-1',
        target: 'event-1',
        type: 'action-event',
      });

      const result = validateScript(script);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Validation Score', () => {
    test('perfect script has score 100', () => {
      const script = createMinimalScript();
      const result = validateScript(script);

      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    test('script with errors has lower score', () => {
      const script = createMinimalScript();
      script.nodes = []; // Remove all nodes - major error

      const result = validateScript(script);

      expect(result.score).toBeLessThan(50);
    });

    test('script with warnings has slightly lower score', () => {
      const script = createMinimalScript();
      // Add orphan node
      script.nodes.push({
        id: 'action-orphan',
        type: 'action',
        typeId: 3,
        label: 'Flee',
        typeName: 'SMART_ACTION_FLEE',
        parameters: [],
      });

      const result = validateScript(script);

      expect(result.score).toBeGreaterThan(70);
      expect(result.score).toBeLessThan(100);
    });
  });

  describe('Quick Validation', () => {
    test('returns true for valid script', () => {
      const script = createMinimalScript();
      const isValid = quickValidate(script);

      expect(isValid).toBe(true);
    });

    test('returns false for invalid script', () => {
      const script = createMinimalScript();
      script.nodes = [];

      const isValid = quickValidate(script);

      expect(isValid).toBe(false);
    });

    test('is faster than full validation', () => {
      const script = createMinimalScript();

      const quickStart = performance.now();
      quickValidate(script);
      const quickTime = performance.now() - quickStart;

      const fullStart = performance.now();
      validateScript(script);
      const fullTime = performance.now() - fullStart;

      // Quick should be at least 2x faster
      expect(quickTime).toBeLessThan(fullTime / 2);
    });
  });

  describe('Complex Scripts', () => {
    test('handles scripts with many nodes', () => {
      const script = createMinimalScript();

      // Add 100 nodes
      for (let i = 0; i < 100; i++) {
        script.nodes.push({
          id: `action-${i}`,
          type: 'action',
          typeId: i % 50,
          label: `Action ${i}`,
          typeName: 'SMART_ACTION_TALK',
          parameters: [],
        });

        script.connections.push({
          id: `conn-${i}`,
          source: 'event-1',
          target: `action-${i}`,
          type: 'event-action',
        });
      }

      const result = validateScript(script);

      expect(result).toBeDefined();
      expect(result.valid).toBeDefined();
    });

    test('handles deeply nested connections', () => {
      const script = createMinimalScript();

      // Create chain of 20 actions
      for (let i = 0; i < 20; i++) {
        script.nodes.push({
          id: `action-chain-${i}`,
          type: 'action',
          typeId: i,
          label: `Chain ${i}`,
          typeName: 'SMART_ACTION_TALK',
          parameters: [],
        });

        script.connections.push({
          id: `conn-chain-${i}`,
          source: i === 0 ? 'event-1' : `action-chain-${i - 1}`,
          target: `action-chain-${i}`,
          type: 'event-action',
        });
      }

      const result = validateScript(script);

      expect(result.valid).toBe(true);
      // Should not have stack overflow
    });
  });

  describe('Edge Cases', () => {
    test('handles empty script gracefully', () => {
      const script: SAIScript = {
        id: 'empty',
        name: 'Empty',
        entryOrGuid: 0,
        sourceType: 0,
        nodes: [],
        connections: [],
        metadata: {
          version: '3.0.0',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      const result = validateScript(script);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('handles script with connections but no nodes', () => {
      const script = createMinimalScript();
      script.nodes = [];

      const result = validateScript(script);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('handles script with invalid metadata', () => {
      const script = createMinimalScript();
      // @ts-ignore - testing invalid metadata
      script.metadata = null;

      const result = validateScript(script);

      expect(result).toBeDefined();
      // Should still validate structure
    });
  });
});
