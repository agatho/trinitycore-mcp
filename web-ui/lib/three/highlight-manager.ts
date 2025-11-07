/**
 * HighlightManager - Visual highlighting for selection and hover
 *
 * Provides outline effects, pulsing animations, and visual feedback
 * for selected and hovered objects in both 2D and 3D views.
 *
 * @module lib/three/highlight-manager
 */

import * as THREE from 'three';

export interface HighlightStyle {
  color: THREE.Color;
  thickness: number;
  pulsing?: boolean;
  pulseSpeed?: number;
  glowIntensity?: number;
}

export interface HighlightOptions {
  selectionStyle?: Partial<HighlightStyle>;
  hoverStyle?: Partial<HighlightStyle>;
}

/**
 * Highlight manager for visual feedback
 */
export class HighlightManager {
  private scene: THREE.Scene;

  // Highlight styles
  private selectionStyle: HighlightStyle;
  private hoverStyle: HighlightStyle;

  // Highlight meshes
  private selectionHighlights: Map<string, THREE.LineSegments> = new Map();
  private hoverHighlight: THREE.LineSegments | null = null;

  // Animation
  private pulsePhase = 0;

  constructor(scene: THREE.Scene, options: HighlightOptions = {}) {
    this.scene = scene;

    // Default selection style (blue)
    this.selectionStyle = {
      color: options.selectionStyle?.color ?? new THREE.Color(0x5555ff),
      thickness: options.selectionStyle?.thickness ?? 2,
      pulsing: options.selectionStyle?.pulsing ?? true,
      pulseSpeed: options.selectionStyle?.pulseSpeed ?? 2.0,
      glowIntensity: options.selectionStyle?.glowIntensity ?? 0.5,
    };

    // Default hover style (yellow)
    this.hoverStyle = {
      color: options.hoverStyle?.color ?? new THREE.Color(0xffff00),
      thickness: options.hoverStyle?.thickness ?? 2,
      pulsing: options.hoverStyle?.pulsing ?? false,
      pulseSpeed: options.hoverStyle?.pulseSpeed ?? 3.0,
      glowIntensity: options.hoverStyle?.glowIntensity ?? 0.3,
    };

    console.log('[HighlightManager] Initialized');
  }

  /**
   * Highlight selected objects
   */
  public setSelection(objects: THREE.Object3D[]): void {
    // Clear existing highlights
    this.clearSelection();

    // Create new highlights
    for (const object of objects) {
      const highlight = this.createHighlight(object, this.selectionStyle);
      if (highlight) {
        const id = object.userData.markerId || object.uuid;
        this.selectionHighlights.set(id, highlight);
        this.scene.add(highlight);
      }
    }
  }

  /**
   * Clear selection highlights
   */
  public clearSelection(): void {
    for (const highlight of this.selectionHighlights.values()) {
      this.scene.remove(highlight);
      highlight.geometry.dispose();
      (highlight.material as THREE.Material).dispose();
    }
    this.selectionHighlights.clear();
  }

  /**
   * Highlight hovered object
   */
  public setHover(object: THREE.Object3D | null): void {
    // Clear existing hover
    this.clearHover();

    // Create new hover highlight
    if (object) {
      this.hoverHighlight = this.createHighlight(object, this.hoverStyle);
      if (this.hoverHighlight) {
        this.scene.add(this.hoverHighlight);
      }
    }
  }

  /**
   * Clear hover highlight
   */
  public clearHover(): void {
    if (this.hoverHighlight) {
      this.scene.remove(this.hoverHighlight);
      this.hoverHighlight.geometry.dispose();
      (this.hoverHighlight.material as THREE.Material).dispose();
      this.hoverHighlight = null;
    }
  }

  /**
   * Create highlight outline for object
   */
  private createHighlight(
    object: THREE.Object3D,
    style: HighlightStyle
  ): THREE.LineSegments | null {
    // Get geometry from object
    let geometry: THREE.BufferGeometry | null = null;

    if (object instanceof THREE.Mesh) {
      geometry = object.geometry;
    }

    if (!geometry) return null;

    // Create edges geometry for outline
    const edges = new THREE.EdgesGeometry(geometry, 15); // 15 degree threshold

    // Create line material
    const material = new THREE.LineBasicMaterial({
      color: style.color,
      linewidth: style.thickness,
    });

    const highlight = new THREE.LineSegments(edges, material);

    // Copy transform from original object
    highlight.position.copy(object.position);
    highlight.rotation.copy(object.rotation);
    highlight.scale.copy(object.scale);

    // Slightly scale up to avoid z-fighting
    highlight.scale.multiplyScalar(1.02);

    // Store style for animation
    highlight.userData.style = style;
    highlight.userData.baseMaterial = material;

    return highlight;
  }

  /**
   * Update animations (call every frame)
   */
  public update(delta: number): void {
    this.pulsePhase += delta;

    // Update selection highlights
    for (const highlight of this.selectionHighlights.values()) {
      const style = highlight.userData.style as HighlightStyle;
      if (style.pulsing) {
        this.animatePulse(highlight, style, this.pulsePhase);
      }
    }

    // Update hover highlight
    if (this.hoverHighlight) {
      const style = this.hoverHighlight.userData.style as HighlightStyle;
      if (style.pulsing) {
        this.animatePulse(this.hoverHighlight, style, this.pulsePhase);
      }
    }
  }

  /**
   * Animate pulsing effect
   */
  private animatePulse(
    highlight: THREE.LineSegments,
    style: HighlightStyle,
    phase: number
  ): void {
    const material = highlight.material as THREE.LineBasicMaterial;

    // Pulse opacity
    const pulseValue = Math.sin(phase * style.pulseSpeed!) * 0.5 + 0.5;
    const opacity = 0.5 + pulseValue * 0.5; // 0.5 to 1.0

    material.opacity = opacity;
    material.transparent = true;

    // Pulse scale
    const scaleValue = 1.0 + pulseValue * 0.05; // 1.0 to 1.05
    highlight.scale.setScalar(scaleValue);
  }

  /**
   * Create glow effect (more advanced - for future enhancement)
   */
  private createGlow(object: THREE.Object3D, style: HighlightStyle): THREE.Mesh {
    // Clone geometry
    const geometry = (object as THREE.Mesh).geometry.clone();

    // Create glow material
    const material = new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: style.color },
        viewVector: { value: new THREE.Vector3() },
        intensity: { value: style.glowIntensity },
      },
      vertexShader: `
        uniform vec3 viewVector;
        varying float intensity;
        void main() {
          vec3 vNormal = normalize(normalMatrix * normal);
          vec3 vView = normalize(viewVector - (modelMatrix * vec4(position, 1.0)).xyz);
          intensity = pow(1.0 - abs(dot(vNormal, vView)), 3.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform float intensity;
        varying float intensity_v;
        void main() {
          vec3 glow = glowColor * intensity_v * intensity;
          gl_FragColor = vec4(glow, intensity_v);
        }
      `,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });

    const glow = new THREE.Mesh(geometry, material);
    glow.position.copy(object.position);
    glow.rotation.copy(object.rotation);
    glow.scale.copy(object.scale).multiplyScalar(1.1);

    return glow;
  }

  /**
   * Set selection style
   */
  public setSelectionStyle(style: Partial<HighlightStyle>): void {
    Object.assign(this.selectionStyle, style);
  }

  /**
   * Set hover style
   */
  public setHoverStyle(style: Partial<HighlightStyle>): void {
    Object.assign(this.hoverStyle, style);
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    this.clearSelection();
    this.clearHover();

    console.log('[HighlightManager] Disposed');
  }
}
