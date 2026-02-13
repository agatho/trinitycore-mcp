/**
 * Unit tests for Ray-AABB intersection
 *
 * Tests the slab-method ray-AABB intersection used for VMap line-of-sight.
 */

import { rayAABBIntersection, createRayFromPoints, distance3D } from "../../src/collision/ray-aabb";
import type { Ray, AABox, Vector3 } from "../../src/collision/types";

// ============================================================================
// Test Fixtures
// ============================================================================

const UNIT_BOX: AABox = {
  min: { x: -1, y: -1, z: -1 },
  max: { x: 1, y: 1, z: 1 },
};

const OFFSET_BOX: AABox = {
  min: { x: 5, y: 5, z: 5 },
  max: { x: 10, y: 10, z: 10 },
};

const FLAT_BOX: AABox = {
  min: { x: -10, y: -0.5, z: -10 },
  max: { x: 10, y: 0.5, z: 10 },
};

// ============================================================================
// rayAABBIntersection Tests
// ============================================================================

describe("rayAABBIntersection", () => {
  describe("basic hit detection", () => {
    it("should detect hit when ray passes through unit box", () => {
      const ray: Ray = {
        origin: { x: -5, y: 0, z: 0 },
        direction: { x: 1, y: 0, z: 0 },
        maxDistance: 20,
      };
      const result = rayAABBIntersection(ray, UNIT_BOX);
      expect(result.hit).toBe(true);
      expect(result.distance).toBeCloseTo(4, 3);
    });

    it("should detect hit along Y axis", () => {
      const ray: Ray = {
        origin: { x: 0, y: -5, z: 0 },
        direction: { x: 0, y: 1, z: 0 },
        maxDistance: 20,
      };
      const result = rayAABBIntersection(ray, UNIT_BOX);
      expect(result.hit).toBe(true);
      expect(result.distance).toBeCloseTo(4, 3);
    });

    it("should detect hit along Z axis", () => {
      const ray: Ray = {
        origin: { x: 0, y: 0, z: -5 },
        direction: { x: 0, y: 0, z: 1 },
        maxDistance: 20,
      };
      const result = rayAABBIntersection(ray, UNIT_BOX);
      expect(result.hit).toBe(true);
      expect(result.distance).toBeCloseTo(4, 3);
    });

    it("should detect hit on diagonal ray", () => {
      const len = Math.sqrt(3);
      const ray: Ray = {
        origin: { x: -5, y: -5, z: -5 },
        direction: { x: 1 / len, y: 1 / len, z: 1 / len },
        maxDistance: 20,
      };
      const result = rayAABBIntersection(ray, UNIT_BOX);
      expect(result.hit).toBe(true);
    });
  });

  describe("miss detection", () => {
    it("should miss when ray goes parallel above box", () => {
      const ray: Ray = {
        origin: { x: -5, y: 5, z: 0 },
        direction: { x: 1, y: 0, z: 0 },
        maxDistance: 20,
      };
      const result = rayAABBIntersection(ray, UNIT_BOX);
      expect(result.hit).toBe(false);
    });

    it("should miss when ray points away from box", () => {
      const ray: Ray = {
        origin: { x: -5, y: 0, z: 0 },
        direction: { x: -1, y: 0, z: 0 },
        maxDistance: 20,
      };
      const result = rayAABBIntersection(ray, UNIT_BOX);
      expect(result.hit).toBe(false);
    });

    it("should miss when maxDistance is too short", () => {
      const ray: Ray = {
        origin: { x: -5, y: 0, z: 0 },
        direction: { x: 1, y: 0, z: 0 },
        maxDistance: 2, // Box starts at x=-1, need distance 4
      };
      const result = rayAABBIntersection(ray, UNIT_BOX);
      expect(result.hit).toBe(false);
    });

    it("should miss when ray passes beside box in Z", () => {
      const ray: Ray = {
        origin: { x: -5, y: 0, z: 3 },
        direction: { x: 1, y: 0, z: 0 },
        maxDistance: 20,
      };
      const result = rayAABBIntersection(ray, UNIT_BOX);
      expect(result.hit).toBe(false);
    });
  });

  describe("offset box", () => {
    it("should detect hit on offset box", () => {
      const ray: Ray = {
        origin: { x: 0, y: 7.5, z: 7.5 },
        direction: { x: 1, y: 0, z: 0 },
        maxDistance: 20,
      };
      const result = rayAABBIntersection(ray, OFFSET_BOX);
      expect(result.hit).toBe(true);
      expect(result.distance).toBeCloseTo(5, 3);
    });
  });

  describe("ray starting inside box", () => {
    it("should detect hit when ray starts inside box", () => {
      const ray: Ray = {
        origin: { x: 0, y: 0, z: 0 },
        direction: { x: 1, y: 0, z: 0 },
        maxDistance: 20,
      };
      const result = rayAABBIntersection(ray, UNIT_BOX);
      expect(result.hit).toBe(true);
      expect(result.distance).toBe(0);
    });
  });

  describe("hit point calculation", () => {
    it("should calculate correct hit point on -X face", () => {
      const ray: Ray = {
        origin: { x: -5, y: 0, z: 0 },
        direction: { x: 1, y: 0, z: 0 },
        maxDistance: 20,
      };
      const result = rayAABBIntersection(ray, UNIT_BOX);
      expect(result.hit).toBe(true);
      expect(result.point.x).toBeCloseTo(-1, 3);
      expect(result.point.y).toBeCloseTo(0, 3);
      expect(result.point.z).toBeCloseTo(0, 3);
    });

    it("should calculate correct normal on -X face", () => {
      const ray: Ray = {
        origin: { x: -5, y: 0, z: 0 },
        direction: { x: 1, y: 0, z: 0 },
        maxDistance: 20,
      };
      const result = rayAABBIntersection(ray, UNIT_BOX);
      expect(result.hit).toBe(true);
      expect(result.normal.x).toBe(-1);
    });
  });

  describe("parallel ray edge cases", () => {
    it("should handle ray parallel to X axis inside Y/Z bounds", () => {
      const ray: Ray = {
        origin: { x: -5, y: 0, z: 0 },
        direction: { x: 1, y: 0, z: 0 },
        maxDistance: 20,
      };
      const result = rayAABBIntersection(ray, UNIT_BOX);
      expect(result.hit).toBe(true);
    });

    it("should miss when parallel to X axis outside Y bounds", () => {
      const ray: Ray = {
        origin: { x: -5, y: 3, z: 0 },
        direction: { x: 1, y: 0, z: 0 },
        maxDistance: 20,
      };
      const result = rayAABBIntersection(ray, UNIT_BOX);
      expect(result.hit).toBe(false);
    });
  });

  describe("flat box", () => {
    it("should detect hit on flat box from above", () => {
      const ray: Ray = {
        origin: { x: 0, y: 5, z: 0 },
        direction: { x: 0, y: -1, z: 0 },
        maxDistance: 20,
      };
      const result = rayAABBIntersection(ray, FLAT_BOX);
      expect(result.hit).toBe(true);
      expect(result.distance).toBeCloseTo(4.5, 3);
    });
  });
});

// ============================================================================
// createRayFromPoints Tests
// ============================================================================

describe("createRayFromPoints", () => {
  it("should create ray with correct direction", () => {
    const start: Vector3 = { x: 0, y: 0, z: 0 };
    const end: Vector3 = { x: 10, y: 0, z: 0 };
    const ray = createRayFromPoints(start, end);

    expect(ray.origin).toEqual(start);
    expect(ray.direction.x).toBeCloseTo(1, 5);
    expect(ray.direction.y).toBeCloseTo(0, 5);
    expect(ray.direction.z).toBeCloseTo(0, 5);
    expect(ray.maxDistance).toBeCloseTo(10, 5);
  });

  it("should normalize diagonal direction", () => {
    const start: Vector3 = { x: 0, y: 0, z: 0 };
    const end: Vector3 = { x: 1, y: 1, z: 1 };
    const ray = createRayFromPoints(start, end);

    const expectedLen = Math.sqrt(3);
    expect(ray.direction.x).toBeCloseTo(1 / expectedLen, 5);
    expect(ray.direction.y).toBeCloseTo(1 / expectedLen, 5);
    expect(ray.direction.z).toBeCloseTo(1 / expectedLen, 5);
    expect(ray.maxDistance).toBeCloseTo(expectedLen, 5);
  });

  it("should handle zero-length ray", () => {
    const point: Vector3 = { x: 5, y: 5, z: 5 };
    const ray = createRayFromPoints(point, point);
    expect(ray.maxDistance).toBe(0);
  });

  it("should handle negative direction", () => {
    const start: Vector3 = { x: 10, y: 0, z: 0 };
    const end: Vector3 = { x: 0, y: 0, z: 0 };
    const ray = createRayFromPoints(start, end);

    expect(ray.direction.x).toBeCloseTo(-1, 5);
    expect(ray.maxDistance).toBeCloseTo(10, 5);
  });
});

// ============================================================================
// distance3D Tests
// ============================================================================

describe("distance3D", () => {
  it("should return 0 for same point", () => {
    const p: Vector3 = { x: 1, y: 2, z: 3 };
    expect(distance3D(p, p)).toBe(0);
  });

  it("should calculate correct distance along X axis", () => {
    const a: Vector3 = { x: 0, y: 0, z: 0 };
    const b: Vector3 = { x: 10, y: 0, z: 0 };
    expect(distance3D(a, b)).toBeCloseTo(10, 5);
  });

  it("should calculate correct 3D distance", () => {
    const a: Vector3 = { x: 0, y: 0, z: 0 };
    const b: Vector3 = { x: 3, y: 4, z: 0 };
    expect(distance3D(a, b)).toBeCloseTo(5, 5);
  });

  it("should be commutative", () => {
    const a: Vector3 = { x: 1, y: 2, z: 3 };
    const b: Vector3 = { x: 4, y: 6, z: 8 };
    expect(distance3D(a, b)).toBeCloseTo(distance3D(b, a), 10);
  });
});
