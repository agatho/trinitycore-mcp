/**
 * Time of Day System
 *
 * Continuous 24-hour day/night cycle system with sun position calculation
 * and smooth lighting transitions.
 */

import * as THREE from 'three';
import type { LightingManager } from './lighting-manager';

export interface TimeOfDayConfig {
  /** Current time in hours (0-24) */
  currentTime: number;

  /** Automatic time progression (hours per real second) */
  timeSpeed: number;

  /** Enable automatic time progression */
  autoProgress: boolean;
}

export interface SunMoonPosition {
  position: THREE.Vector3;
  color: THREE.Color;
  intensity: number;
}

/**
 * Time of Day System for dynamic lighting
 */
export class TimeOfDaySystem {
  private lightingManager: LightingManager;
  private config: TimeOfDayConfig;

  // Sun parameters
  private sunDistance = 2000;
  private sunOrbitRadius = 1500;

  constructor(lightingManager: LightingManager, config: Partial<TimeOfDayConfig> = {}) {
    this.lightingManager = lightingManager;
    this.config = {
      currentTime: config.currentTime ?? 12, // Noon
      timeSpeed: config.timeSpeed ?? 0.1, // 0.1 hours per second = 6 minutes per real-time minute
      autoProgress: config.autoProgress ?? false,
    };
  }

  /**
   * Set time of day (0-24 hours)
   */
  public setTime(hours: number): void {
    this.config.currentTime = hours % 24;
    this.updateLighting();
  }

  /**
   * Get current time
   */
  public getTime(): number {
    return this.config.currentTime;
  }

  /**
   * Set time speed (hours per real second)
   */
  public setTimeSpeed(speed: number): void {
    this.config.timeSpeed = speed;
  }

  /**
   * Enable/disable automatic time progression
   */
  public setAutoProgress(enabled: boolean): void {
    this.config.autoProgress = enabled;
  }

  /**
   * Update time and lighting (call every frame)
   */
  public update(deltaSeconds: number): void {
    if (this.config.autoProgress) {
      this.config.currentTime += this.config.timeSpeed * deltaSeconds;
      this.config.currentTime %= 24;
      this.updateLighting();
    }
  }

  /**
   * Update lighting based on current time
   */
  private updateLighting(): void {
    const sunMoon = this.calculateSunMoonPosition(this.config.currentTime);

    // Update directional light (sun/moon)
    this.lightingManager.setSunPosition(
      sunMoon.position.x,
      sunMoon.position.y,
      sunMoon.position.z
    );
    this.lightingManager.setSunColor(sunMoon.color.getHex());
    this.lightingManager.setSunIntensity(sunMoon.intensity);

    // Update ambient light
    const ambient = this.calculateAmbientLight(this.config.currentTime);
    this.lightingManager.setAmbientColor(ambient.color.getHex());
    this.lightingManager.setAmbientIntensity(ambient.intensity);
  }

  /**
   * Calculate sun/moon position based on time
   */
  private calculateSunMoonPosition(hours: number): SunMoonPosition {
    // Convert hours to angle (0 hours = midnight, 12 hours = noon)
    // Sun rises at ~6am, sets at ~6pm
    const angle = ((hours - 6) / 12) * Math.PI; // 0 to 2π over 24 hours

    // Calculate sun position (circular orbit)
    const x = Math.cos(angle) * this.sunDistance;
    const y = Math.sin(angle) * this.sunOrbitRadius; // Height varies with time
    const z = 500;

    const position = new THREE.Vector3(x, y, z);

    // Determine if it's day or night
    const isDaytime = hours >= 6 && hours < 18;

    // Calculate sun color and intensity based on time
    let color: THREE.Color;
    let intensity: number;

    if (hours >= 5 && hours < 7) {
      // Dawn (5am-7am) - orange/pink
      const progress = (hours - 5) / 2;
      color = new THREE.Color().lerpColors(
        new THREE.Color(0xff6b35), // Dark orange
        new THREE.Color(0xffa07a), // Light salmon
        progress
      );
      intensity = 0.3 + progress * 0.5;
    } else if (hours >= 7 && hours < 17) {
      // Day (7am-5pm) - bright white/yellow
      const noonFactor = 1 - Math.abs(hours - 12) / 5; // Peak at noon
      color = new THREE.Color(0xfffff0); // Warm white
      intensity = 0.8 + noonFactor * 0.3;
    } else if (hours >= 17 && hours < 19) {
      // Dusk (5pm-7pm) - orange/red
      const progress = (hours - 17) / 2;
      color = new THREE.Color().lerpColors(
        new THREE.Color(0xff4500), // Orange red
        new THREE.Color(0x8b4513), // Saddle brown
        progress
      );
      intensity = 0.6 - progress * 0.3;
    } else {
      // Night (7pm-5am) - cool blue (moon)
      color = new THREE.Color(0xadd8e6); // Light blue
      intensity = 0.15;
    }

    return { position, color, intensity };
  }

  /**
   * Calculate ambient light based on time
   */
  private calculateAmbientLight(hours: number): { color: THREE.Color; intensity: number } {
    let color: THREE.Color;
    let intensity: number;

    if (hours >= 5 && hours < 7) {
      // Dawn
      const progress = (hours - 5) / 2;
      color = new THREE.Color().lerpColors(
        new THREE.Color(0x1a1a2e), // Dark blue
        new THREE.Color(0x6b5b95), // Purple
        progress
      );
      intensity = 0.2 + progress * 0.2;
    } else if (hours >= 7 && hours < 17) {
      // Day
      color = new THREE.Color(0xffffff);
      intensity = 0.5;
    } else if (hours >= 17 && hours < 19) {
      // Dusk
      const progress = (hours - 17) / 2;
      color = new THREE.Color().lerpColors(
        new THREE.Color(0xff6347), // Tomato
        new THREE.Color(0x2f1f1f), // Dark red-brown
        progress
      );
      intensity = 0.4 - progress * 0.2;
    } else {
      // Night
      color = new THREE.Color(0x0a0a1a);
      intensity = 0.15;
    }

    return { color, intensity };
  }

  /**
   * Get time period name
   */
  public getTimePeriod(): string {
    const h = this.config.currentTime;
    if (h >= 5 && h < 7) return 'Dawn';
    if (h >= 7 && h < 12) return 'Morning';
    if (h >= 12 && h < 17) return 'Afternoon';
    if (h >= 17 && h < 19) return 'Dusk';
    if (h >= 19 && h < 22) return 'Evening';
    return 'Night';
  }

  /**
   * Get formatted time string
   */
  public getFormattedTime(): string {
    const hours = Math.floor(this.config.currentTime);
    const minutes = Math.floor((this.config.currentTime - hours) * 60);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  }

  /**
   * Quick presets
   */
  public setPreset(preset: 'sunrise' | 'noon' | 'sunset' | 'midnight'): void {
    switch (preset) {
      case 'sunrise':
        this.setTime(6);
        break;
      case 'noon':
        this.setTime(12);
        break;
      case 'sunset':
        this.setTime(18);
        break;
      case 'midnight':
        this.setTime(0);
        break;
    }
  }

  /**
   * Get configuration
   */
  public getConfig(): TimeOfDayConfig {
    return { ...this.config };
  }
}
