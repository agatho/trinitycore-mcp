/**
 * TerrainShader - Custom GLSL shaders for terrain rendering
 *
 * Provides elevation-based coloring, slope detection, and water effects
 * for realistic terrain visualization.
 *
 * @module lib/three/terrain-shader
 */

import * as THREE from 'three';

/**
 * Elevation-based terrain shader
 */
export const ElevationTerrainShader: THREE.Shader = {
  uniforms: {
    minHeight: { value: -500.0 },
    maxHeight: { value: 500.0 },
    waterLevel: { value: 0.0 },
    time: { value: 0.0 },
  },

  vertexShader: /* glsl */ `
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying float vHeight;

    void main() {
      vPosition = position;
      vNormal = normal;
      vHeight = position.y;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform float minHeight;
    uniform float maxHeight;
    uniform float waterLevel;

    varying vec3 vPosition;
    varying vec3 vNormal;
    varying float vHeight;

    // Color gradient based on height
    vec3 getHeightColor(float height) {
      float normalized = (height - minHeight) / (maxHeight - minHeight);
      normalized = clamp(normalized, 0.0, 1.0);

      vec3 colorLow = vec3(0.2, 0.3, 0.5);      // Deep blue (water)
      vec3 colorBeach = vec3(0.9, 0.8, 0.6);    // Sandy beach
      vec3 colorGrass = vec3(0.3, 0.6, 0.2);    // Grass
      vec3 colorRock = vec3(0.5, 0.5, 0.5);     // Rock
      vec3 colorSnow = vec3(0.95, 0.95, 0.98);  // Snow

      // Multi-step gradient
      if (normalized < 0.2) {
        // Deep water to shallow water
        return mix(colorLow, colorBeach, normalized * 5.0);
      } else if (normalized < 0.4) {
        // Shallow water to grass
        return mix(colorBeach, colorGrass, (normalized - 0.2) * 5.0);
      } else if (normalized < 0.7) {
        // Grass to rock
        return mix(colorGrass, colorRock, (normalized - 0.4) / 0.3);
      } else {
        // Rock to snow
        return mix(colorRock, colorSnow, (normalized - 0.7) / 0.3);
      }
    }

    // Slope-based shading
    float getSlope() {
      vec3 normal = normalize(vNormal);
      vec3 up = vec3(0.0, 1.0, 0.0);
      return 1.0 - dot(normal, up);
    }

    void main() {
      vec3 baseColor = getHeightColor(vHeight);

      // Apply slope darkening (steep slopes = darker)
      float slope = getSlope();
      float slopeFactor = 1.0 - (slope * 0.3);
      vec3 finalColor = baseColor * slopeFactor;

      // Simple lighting based on normal
      vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
      float diffuse = max(dot(normalize(vNormal), lightDir), 0.3);
      finalColor *= diffuse;

      // Underwater tint
      if (vHeight < waterLevel) {
        finalColor = mix(finalColor, vec3(0.1, 0.2, 0.4), 0.5);
      }

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `,
};

/**
 * Water surface shader with animation
 */
export const WaterShader: THREE.Shader = {
  uniforms: {
    time: { value: 0.0 },
    waterColor: { value: new THREE.Color(0x1e90ff) },
    opacity: { value: 0.7 },
  },

  vertexShader: /* glsl */ `
    uniform float time;

    varying vec3 vPosition;
    varying vec2 vUv;

    void main() {
      vPosition = position;
      vUv = uv;

      // Animated wave effect
      vec3 pos = position;
      pos.y += sin(pos.x * 0.1 + time) * 0.5;
      pos.y += cos(pos.z * 0.1 + time * 1.5) * 0.3;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform vec3 waterColor;
    uniform float opacity;
    uniform float time;

    varying vec3 vPosition;
    varying vec2 vUv;

    void main() {
      // Animated water effect
      float wave = sin(vUv.x * 10.0 + time) * 0.1 +
                   cos(vUv.y * 10.0 + time * 1.3) * 0.1;

      vec3 color = waterColor + vec3(wave);

      gl_FragColor = vec4(color, opacity);
    }
  `,
};

/**
 * Create elevation-based terrain material
 */
export function createElevationTerrainMaterial(
  minHeight: number = -500,
  maxHeight: number = 500,
  waterLevel: number = 0
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(ElevationTerrainShader.uniforms),
    vertexShader: ElevationTerrainShader.vertexShader,
    fragmentShader: ElevationTerrainShader.fragmentShader,
    side: THREE.DoubleSide,
    lights: false,
  });
}

/**
 * Create animated water material
 */
export function createWaterMaterial(
  waterColor: THREE.Color = new THREE.Color(0x1e90ff),
  opacity: number = 0.7
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(WaterShader.uniforms),
    vertexShader: WaterShader.vertexShader,
    fragmentShader: WaterShader.fragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
  });

  material.uniforms.waterColor.value = waterColor;
  material.uniforms.opacity.value = opacity;

  return material;
}

/**
 * Update shader time uniform for animations
 */
export function updateShaderTime(material: THREE.ShaderMaterial, time: number): void {
  if (material.uniforms.time) {
    material.uniforms.time.value = time;
  }
}
