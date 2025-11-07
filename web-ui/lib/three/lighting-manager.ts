/**
 * LightingManager - Dynamic lighting system for 3D scenes
 *
 * Manages ambient, directional, and hemisphere lighting with
 * shadow configuration and time-of-day simulation.
 *
 * @module lib/three/lighting-manager
 */

import * as THREE from 'three';

export interface LightingOptions {
  ambientIntensity?: number;
  ambientColor?: number;
  sunIntensity?: number;
  sunColor?: number;
  sunPosition?: { x: number; y: number; z: number };
  hemisphereEnabled?: boolean;
  hemisphereSkyColor?: number;
  hemisphereGroundColor?: number;
  hemisphereIntensity?: number;
  shadowsEnabled?: boolean;
  shadowMapSize?: number;
  shadowCameraNear?: number;
  shadowCameraFar?: number;
  shadowCameraSize?: number;
}

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

export interface LightingPreset {
  name: string;
  ambientColor: number;
  ambientIntensity: number;
  sunColor: number;
  sunIntensity: number;
  sunPosition: { x: number; y: number; z: number };
  hemisphereSkyColor: number;
  hemisphereGroundColor: number;
  hemisphereIntensity: number;
}

/**
 * Lighting manager for 3D scenes
 */
export class LightingManager {
  private scene: THREE.Scene;

  // Lights
  private ambientLight: THREE.AmbientLight;
  private directionalLight: THREE.DirectionalLight;
  private hemisphereLight: THREE.HemisphereLight | null = null;

  // Shadow camera helper (debug)
  private shadowCameraHelper: THREE.CameraHelper | null = null;

  // Options
  private options: Required<LightingOptions>;

  // Presets
  private static readonly PRESETS: Record<TimeOfDay, LightingPreset> = {
    dawn: {
      name: 'Dawn',
      ambientColor: 0x6b5b95,
      ambientIntensity: 0.3,
      sunColor: 0xffa07a,
      sunIntensity: 0.6,
      sunPosition: { x: 1000, y: 300, z: 500 },
      hemisphereSkyColor: 0x87ceeb,
      hemisphereGroundColor: 0x362d26,
      hemisphereIntensity: 0.4,
    },
    day: {
      name: 'Day',
      ambientColor: 0xffffff,
      ambientIntensity: 0.5,
      sunColor: 0xffffff,
      sunIntensity: 1.0,
      sunPosition: { x: 1000, y: 1000, z: 500 },
      hemisphereSkyColor: 0x87ceeb,
      hemisphereGroundColor: 0x8b7355,
      hemisphereIntensity: 0.6,
    },
    dusk: {
      name: 'Dusk',
      ambientColor: 0xff6347,
      ambientIntensity: 0.3,
      sunColor: 0xff4500,
      sunIntensity: 0.5,
      sunPosition: { x: 1000, y: 200, z: -500 },
      hemisphereSkyColor: 0xff6347,
      hemisphereGroundColor: 0x2f1f1f,
      hemisphereIntensity: 0.4,
    },
    night: {
      name: 'Night',
      ambientColor: 0x1a1a2e,
      ambientIntensity: 0.2,
      sunColor: 0xadd8e6,
      sunIntensity: 0.2,
      sunPosition: { x: -1000, y: 500, z: 0 },
      hemisphereSkyColor: 0x000428,
      hemisphereGroundColor: 0x000000,
      hemisphereIntensity: 0.2,
    },
  };

  constructor(scene: THREE.Scene, options: LightingOptions = {}) {
    this.scene = scene;

    this.options = {
      ambientIntensity: options.ambientIntensity ?? 0.5,
      ambientColor: options.ambientColor ?? 0xffffff,
      sunIntensity: options.sunIntensity ?? 1.0,
      sunColor: options.sunColor ?? 0xffffff,
      sunPosition: options.sunPosition ?? { x: 1000, y: 1000, z: 500 },
      hemisphereEnabled: options.hemisphereEnabled ?? true,
      hemisphereSkyColor: options.hemisphereSkyColor ?? 0x87ceeb,
      hemisphereGroundColor: options.hemisphereGroundColor ?? 0x8b7355,
      hemisphereIntensity: options.hemisphereIntensity ?? 0.6,
      shadowsEnabled: options.shadowsEnabled ?? true,
      shadowMapSize: options.shadowMapSize ?? 2048,
      shadowCameraNear: options.shadowCameraNear ?? 0.5,
      shadowCameraFar: options.shadowCameraFar ?? 5000,
      shadowCameraSize: options.shadowCameraSize ?? 2000,
    };

    // Create lights
    this.ambientLight = this.createAmbientLight();
    this.directionalLight = this.createDirectionalLight();

    if (this.options.hemisphereEnabled) {
      this.hemisphereLight = this.createHemisphereLight();
    }

    console.log('[LightingManager] Initialized');
  }

  /**
   * Create ambient light
   */
  private createAmbientLight(): THREE.AmbientLight {
    const light = new THREE.AmbientLight(
      this.options.ambientColor,
      this.options.ambientIntensity
    );
    this.scene.add(light);
    return light;
  }

  /**
   * Create directional light (sun)
   */
  private createDirectionalLight(): THREE.DirectionalLight {
    const light = new THREE.DirectionalLight(
      this.options.sunColor,
      this.options.sunIntensity
    );

    light.position.set(
      this.options.sunPosition.x,
      this.options.sunPosition.y,
      this.options.sunPosition.z
    );

    // Configure shadows
    if (this.options.shadowsEnabled) {
      light.castShadow = true;
      light.shadow.mapSize.width = this.options.shadowMapSize;
      light.shadow.mapSize.height = this.options.shadowMapSize;
      light.shadow.camera.near = this.options.shadowCameraNear;
      light.shadow.camera.far = this.options.shadowCameraFar;

      // Orthographic shadow camera for directional light
      const size = this.options.shadowCameraSize;
      light.shadow.camera.left = -size;
      light.shadow.camera.right = size;
      light.shadow.camera.top = size;
      light.shadow.camera.bottom = -size;

      // Shadow bias to prevent shadow acne
      light.shadow.bias = -0.0001;
      light.shadow.normalBias = 0.02;
    }

    this.scene.add(light);
    return light;
  }

  /**
   * Create hemisphere light (sky/ground)
   */
  private createHemisphereLight(): THREE.HemisphereLight {
    const light = new THREE.HemisphereLight(
      this.options.hemisphereSkyColor,
      this.options.hemisphereGroundColor,
      this.options.hemisphereIntensity
    );
    this.scene.add(light);
    return light;
  }

  /**
   * Set ambient light intensity
   */
  public setAmbientIntensity(intensity: number): void {
    this.ambientLight.intensity = intensity;
  }

  /**
   * Set ambient light color
   */
  public setAmbientColor(color: number): void {
    this.ambientLight.color.setHex(color);
  }

  /**
   * Set sun intensity
   */
  public setSunIntensity(intensity: number): void {
    this.directionalLight.intensity = intensity;
  }

  /**
   * Set sun color
   */
  public setSunColor(color: number): void {
    this.directionalLight.color.setHex(color);
  }

  /**
   * Set sun position
   */
  public setSunPosition(x: number, y: number, z: number): void {
    this.directionalLight.position.set(x, y, z);
  }

  /**
   * Enable/disable shadows
   */
  public setShadowsEnabled(enabled: boolean): void {
    this.directionalLight.castShadow = enabled;
  }

  /**
   * Apply lighting preset
   */
  public applyPreset(timeOfDay: TimeOfDay): void {
    const preset = LightingManager.PRESETS[timeOfDay];

    this.ambientLight.color.setHex(preset.ambientColor);
    this.ambientLight.intensity = preset.ambientIntensity;

    this.directionalLight.color.setHex(preset.sunColor);
    this.directionalLight.intensity = preset.sunIntensity;
    this.directionalLight.position.set(
      preset.sunPosition.x,
      preset.sunPosition.y,
      preset.sunPosition.z
    );

    if (this.hemisphereLight) {
      this.hemisphereLight.color.setHex(preset.hemisphereSkyColor);
      this.hemisphereLight.groundColor.setHex(preset.hemisphereGroundColor);
      this.hemisphereLight.intensity = preset.hemisphereIntensity;
    }

    console.log('[LightingManager] Applied preset:', preset.name);
  }

  /**
   * Smooth transition to preset
   */
  public transitionToPreset(timeOfDay: TimeOfDay, duration: number = 2000): void {
    const preset = LightingManager.PRESETS[timeOfDay];

    // Store initial values
    const startAmbientColor = this.ambientLight.color.clone();
    const startAmbientIntensity = this.ambientLight.intensity;
    const startSunColor = this.directionalLight.color.clone();
    const startSunIntensity = this.directionalLight.intensity;
    const startSunPosition = this.directionalLight.position.clone();

    const startTime = performance.now();

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease in-out
      const t = progress < 0.5
        ? 2 * progress * progress
        : -1 + (4 - 2 * progress) * progress;

      // Interpolate colors
      this.ambientLight.color.lerpColors(
        startAmbientColor,
        new THREE.Color(preset.ambientColor),
        t
      );

      this.directionalLight.color.lerpColors(
        startSunColor,
        new THREE.Color(preset.sunColor),
        t
      );

      // Interpolate intensities
      this.ambientLight.intensity =
        startAmbientIntensity + (preset.ambientIntensity - startAmbientIntensity) * t;
      this.directionalLight.intensity =
        startSunIntensity + (preset.sunIntensity - startSunIntensity) * t;

      // Interpolate sun position
      this.directionalLight.position.lerpVectors(
        startSunPosition,
        new THREE.Vector3(
          preset.sunPosition.x,
          preset.sunPosition.y,
          preset.sunPosition.z
        ),
        t
      );

      // Hemisphere light
      if (this.hemisphereLight) {
        this.hemisphereLight.intensity =
          this.hemisphereLight.intensity +
          (preset.hemisphereIntensity - this.hemisphereLight.intensity) * t;
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        console.log('[LightingManager] Transition complete:', preset.name);
      }
    };

    animate();
  }

  /**
   * Show shadow camera helper (debug)
   */
  public showShadowCameraHelper(show: boolean): void {
    if (show && !this.shadowCameraHelper) {
      this.shadowCameraHelper = new THREE.CameraHelper(this.directionalLight.shadow.camera);
      this.scene.add(this.shadowCameraHelper);
    } else if (!show && this.shadowCameraHelper) {
      this.scene.remove(this.shadowCameraHelper);
      this.shadowCameraHelper.dispose();
      this.shadowCameraHelper = null;
    }
  }

  /**
   * Update shadow camera to follow target
   */
  public updateShadowCamera(targetX: number, targetZ: number): void {
    // Position shadow camera to follow the target area
    this.directionalLight.target.position.set(targetX, 0, targetZ);
    this.directionalLight.target.updateMatrixWorld();

    if (this.shadowCameraHelper) {
      this.shadowCameraHelper.update();
    }
  }

  /**
   * Get ambient light
   */
  public getAmbientLight(): THREE.AmbientLight {
    return this.ambientLight;
  }

  /**
   * Get directional light
   */
  public getDirectionalLight(): THREE.DirectionalLight {
    return this.directionalLight;
  }

  /**
   * Get hemisphere light
   */
  public getHemisphereLight(): THREE.HemisphereLight | null {
    return this.hemisphereLight;
  }

  /**
   * Dispose of all lights
   */
  public dispose(): void {
    this.scene.remove(this.ambientLight);
    this.scene.remove(this.directionalLight);

    if (this.hemisphereLight) {
      this.scene.remove(this.hemisphereLight);
    }

    if (this.shadowCameraHelper) {
      this.shadowCameraHelper.dispose();
      this.scene.remove(this.shadowCameraHelper);
    }

    console.log('[LightingManager] Disposed');
  }
}
