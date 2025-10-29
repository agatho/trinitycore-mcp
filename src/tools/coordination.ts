/**
 * Multi-Bot Coordination MCP
 *
 * Provides multi-bot group coordination, DPS optimization, composition analysis,
 * cooldown synchronization, and tactical coordination for group content.
 *
 * @module coordination
 */

import { queryWorld } from "../database/connection";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface BotInfo {
  botId: string;
  name: string;
  classId: number;
  className: string;
  specId: number;
  specName: string;
  level: number;
  itemLevel: number;
  role: "tank" | "healer" | "melee_dps" | "ranged_dps";
  position: { x: number; y: number; z: number };
  health: number;
  maxHealth: number;
  power: number;
  maxPower: number;
  powerType: "mana" | "rage" | "energy" | "focus" | "runic_power";
}

export interface GroupComposition {
  groupId: string;
  bots: BotInfo[];
  tanks: BotInfo[];
  healers: BotInfo[];
  meleeDps: BotInfo[];
  rangedDps: BotInfo[];
  totalDps: number;
  totalHps: number;
  balance: number; // 0-100 score
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface CooldownCoordination {
  groupId: string;
  cooldownPlan: CooldownPhase[];
  totalDuration: number;
  dpsWindows: Array<{
    startTime: number;
    duration: number;
    expectedDps: number;
    activeCooldowns: string[];
  }>;
}

export interface CooldownPhase {
  phaseNumber: number;
  startTime: number;
  duration: number;
  cooldowns: Array<{
    botId: string;
    botName: string;
    abilityId: number;
    abilityName: string;
    type: "offensive" | "defensive" | "utility" | "healing";
    duration: number;
    effect: string;
  }>;
  phaseDescription: string;
}

export interface TacticalAssignment {
  encounterId: string;
  encounterName: string;
  phase: number;
  assignments: Array<{
    botId: string;
    botName: string;
    role: string;
    task: string;
    priority: "critical" | "high" | "medium" | "low";
    timing: string;
  }>;
  interruptOrder: string[];
  ccTargets: Array<{ target: string; ccer: string; ccType: string }>;
  positioning: Array<{ botId: string; position: string; reason: string }>;
}

export interface DpsOptimization {
  groupId: string;
  currentDps: number;
  potentialDps: number;
  dpsGap: number;
  bottlenecks: Array<{
    botId: string;
    botName: string;
    currentDps: number;
    potentialDps: number;
    issues: string[];
    recommendations: string[];
  }>;
  groupOptimizations: string[];
}

export interface FormationStrategy {
  formationType: "spread" | "stack" | "line" | "circle" | "wedge";
  positions: Array<{
    botId: string;
    role: string;
    x: number;
    y: number;
    z: number;
    facing: number;
  }>;
  spacing: number;
  centerPoint: { x: number; y: number; z: number };
  purpose: string;
}

export interface CombatRotation {
  botId: string;
  rotation: Array<{
    stepNumber: number;
    condition: string;
    abilityId: number;
    abilityName: string;
    priority: number;
    cooldown: number;
  }>;
  aoeRotation: Array<{
    stepNumber: number;
    targetCount: number;
    abilityId: number;
    abilityName: string;
  }>;
  defensiveRotation: Array<{
    trigger: string;
    abilityId: number;
    abilityName: string;
  }>;
}

export interface ResourceCoordination {
  groupId: string;
  resources: Array<{
    botId: string;
    botName: string;
    resourceType: "mana" | "rage" | "energy" | "focus" | "runic_power" | "soul_shards";
    current: number;
    max: number;
    regenRate: number;
    consumptionRate: number;
    timeToEmpty: number;
    isBottleneck: boolean;
  }>;
  healerMana: Array<{
    healerId: string;
    healerName: string;
    manaPercent: number;
    timeToOom: number;
    recommendation: string;
  }>;
  tankThreat: Array<{
    tankId: string;
    tankName: string;
    threat: number;
    tps: number;
    isStable: boolean;
  }>;
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Analyze group composition
 */
export function analyzeGroupComposition(bots: BotInfo[]): GroupComposition {
  const tanks = bots.filter(b => b.role === "tank");
  const healers = bots.filter(b => b.role === "healer");
  const meleeDps = bots.filter(b => b.role === "melee_dps");
  const rangedDps = bots.filter(b => b.role === "ranged_dps");

  // Calculate estimated DPS/HPS based on bot stats
  const totalDps = [...meleeDps, ...rangedDps].reduce((sum, bot) => {
    return sum + estimateDpsFromItemLevel(bot.itemLevel, bot.role);
  }, 0);

  const totalHps = healers.reduce((sum, bot) => {
    return sum + estimateHpsFromItemLevel(bot.itemLevel);
  }, 0);

  // Analyze balance
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  let balance = 100;

  // Check tank count
  if (tanks.length === 0) {
    weaknesses.push("No tank - group cannot survive");
    balance -= 40;
    recommendations.push("Add a tank to the group");
  } else if (tanks.length > 2) {
    weaknesses.push("Too many tanks - reducing DPS");
    balance -= 10;
  } else {
    strengths.push(`${tanks.length} tank(s) - appropriate for content`);
  }

  // Check healer count
  if (healers.length === 0) {
    weaknesses.push("No healer - unsustainable for group content");
    balance -= 35;
    recommendations.push("Add a healer to the group");
  } else if (healers.length >= 2) {
    strengths.push("Multiple healers - good survivability");
  }

  // Check DPS count
  const totalDpsCount = meleeDps.length + rangedDps.length;
  if (totalDpsCount < 3) {
    weaknesses.push("Low DPS count - slow kill times");
    balance -= 15;
    recommendations.push("Add more DPS to improve kill speed");
  } else if (totalDpsCount >= 3) {
    strengths.push(`${totalDpsCount} DPS - good damage output`);
  }

  // Check ranged/melee balance
  if (meleeDps.length > 0 && rangedDps.length > 0) {
    strengths.push("Balanced melee and ranged DPS");
  } else if (totalDpsCount > 3) {
    weaknesses.push("All DPS are same type - may struggle with positioning mechanics");
    balance -= 5;
  }

  // Check class diversity
  const uniqueClasses = new Set(bots.map(b => b.classId)).size;
  if (uniqueClasses >= bots.length * 0.7) {
    strengths.push("Good class diversity - comprehensive utility");
  } else {
    weaknesses.push("Limited class diversity - may lack key utilities");
    balance -= 10;
    recommendations.push("Consider more class variety for better utility coverage");
  }

  return {
    groupId: "group_" + Date.now(),
    bots,
    tanks,
    healers,
    meleeDps,
    rangedDps,
    totalDps,
    totalHps,
    balance: Math.max(0, balance),
    strengths,
    weaknesses,
    recommendations
  };
}

/**
 * Coordinate cooldown usage across group
 */
export function coordinateCooldowns(
  bots: BotInfo[],
  encounterDuration: number
): CooldownCoordination {
  const cooldownPlan: CooldownPhase[] = [];
  const dpsWindows: CooldownCoordination["dpsWindows"] = [];

  // Define major cooldown phases (heroism at start, then rotating cooldowns)
  const phases = Math.ceil(encounterDuration / 120); // 2-minute phases

  for (let i = 0; i < phases; i++) {
    const phaseStart = i * 120;
    const phaseCooldowns: CooldownPhase["cooldowns"] = [];

    // First phase: Use Bloodlust/Heroism and major cooldowns
    if (i === 0) {
      phaseCooldowns.push({
        botId: "support_1",
        botName: "Support Bot",
        abilityId: 2825,
        abilityName: "Bloodlust",
        type: "offensive",
        duration: 40,
        effect: "30% haste for all group members"
      });

      // All DPS use major cooldowns
      for (const bot of bots.filter(b => b.role.includes("dps"))) {
        phaseCooldowns.push({
          botId: bot.botId,
          botName: bot.name,
          abilityId: getMajorCooldown(bot.classId),
          abilityName: getMajorCooldownName(bot.classId),
          type: "offensive",
          duration: 20,
          effect: "Major DPS cooldown"
        });
      }

      dpsWindows.push({
        startTime: 0,
        duration: 40,
        expectedDps: bots.filter(b => b.role.includes("dps")).length * 80000,
        activeCooldowns: ["Bloodlust", "All major cooldowns"]
      });
    } else {
      // Rotating cooldowns in later phases
      const rotatingBot = bots.filter(b => b.role.includes("dps"))[i % bots.length];

      if (rotatingBot) {
        phaseCooldowns.push({
          botId: rotatingBot.botId,
          botName: rotatingBot.name,
          abilityId: getMajorCooldown(rotatingBot.classId),
          abilityName: getMajorCooldownName(rotatingBot.classId),
          type: "offensive",
          duration: 20,
          effect: "Rotating DPS cooldown"
        });

        dpsWindows.push({
          startTime: phaseStart,
          duration: 20,
          expectedDps: bots.filter(b => b.role.includes("dps")).length * 60000,
          activeCooldowns: [getMajorCooldownName(rotatingBot.classId)]
        });
      }
    }

    cooldownPlan.push({
      phaseNumber: i + 1,
      startTime: phaseStart,
      duration: 120,
      cooldowns: phaseCooldowns,
      phaseDescription: i === 0 ? "Opener - use all cooldowns" : `Phase ${i + 1} - rotating cooldowns`
    });
  }

  return {
    groupId: "group_" + Date.now(),
    cooldownPlan,
    totalDuration: encounterDuration,
    dpsWindows
  };
}

/**
 * Create tactical assignments for encounter
 */
export function createTacticalAssignments(
  bots: BotInfo[],
  encounterId: string,
  encounterName: string,
  phase: number
): TacticalAssignment {
  const assignments: TacticalAssignment["assignments"] = [];

  // Tank assignments
  const tanks = bots.filter(b => b.role === "tank");
  for (let i = 0; i < tanks.length; i++) {
    assignments.push({
      botId: tanks[i].botId,
      botName: tanks[i].name,
      role: "Main Tank",
      task: i === 0 ? "Tank boss and maintain threat" : "Off-tank adds",
      priority: "critical",
      timing: "Throughout encounter"
    });
  }

  // Healer assignments
  const healers = bots.filter(b => b.role === "healer");
  for (let i = 0; i < healers.length; i++) {
    assignments.push({
      botId: healers[i].botId,
      botName: healers[i].name,
      role: "Healer",
      task: i === 0 ? "Tank healing priority" : "Raid healing and dispels",
      priority: "critical",
      timing: "Throughout encounter"
    });
  }

  // DPS assignments
  const dps = bots.filter(b => b.role.includes("dps"));
  const interruptOrder: string[] = [];

  for (let i = 0; i < dps.length; i++) {
    const hasInterrupt = hasInterruptAbility(dps[i].classId);

    assignments.push({
      botId: dps[i].botId,
      botName: dps[i].name,
      role: "DPS",
      task: hasInterrupt ? "DPS and interrupt rotation" : "DPS priority target",
      priority: "high",
      timing: "Throughout encounter"
    });

    if (hasInterrupt) {
      interruptOrder.push(dps[i].name);
    }
  }

  // CC targets (example)
  const ccTargets: TacticalAssignment["ccTargets"] = [];
  if (dps.length >= 2) {
    ccTargets.push({
      target: "Add 1",
      ccer: dps[0].name,
      ccType: getCCAbility(dps[0].classId)
    });
  }

  // Positioning
  const positioning: TacticalAssignment["positioning"] = [];

  // Tanks at front
  for (const tank of tanks) {
    positioning.push({
      botId: tank.botId,
      position: "Front - facing boss away from raid",
      reason: "Tank positioning to avoid cleave damage"
    });
  }

  // Ranged spread out
  const ranged = bots.filter(b => b.role === "ranged_dps" || b.role === "healer");
  for (const bot of ranged) {
    positioning.push({
      botId: bot.botId,
      position: "20+ yards spread",
      reason: "Avoid AoE damage and spread mechanics"
    });
  }

  return {
    encounterId,
    encounterName,
    phase,
    assignments,
    interruptOrder,
    ccTargets,
    positioning
  };
}

/**
 * Optimize group DPS
 */
export function optimizeGroupDps(bots: BotInfo[], currentDps: number): DpsOptimization {
  const bottlenecks: DpsOptimization["bottlenecks"] = [];
  let potentialDps = 0;

  const dpsPlayers = bots.filter(b => b.role.includes("dps"));
  const totalExpectedDps = dpsPlayers.reduce((sum, b) => sum + estimateDpsFromItemLevel(b.itemLevel, b.role), 0);

  for (const bot of dpsPlayers) {
    // Estimate potential DPS based on ilvl
    const expectedDps = estimateDpsFromItemLevel(bot.itemLevel, bot.role);
    potentialDps += expectedDps;

    // Calculate bot's estimated current contribution proportional to their expected DPS
    // If they have higher ilvl/expected DPS, they should contribute more to total
    const contributionRatio = totalExpectedDps > 0 ? expectedDps / totalExpectedDps : 1 / dpsPlayers.length;
    const botCurrentDps = currentDps * contributionRatio;

    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check if bot is underperforming
    if (botCurrentDps < expectedDps * 0.8) {
      if (bot.itemLevel < 470) {
        issues.push("Item level too low");
        recommendations.push("Upgrade gear through dungeons or crafting");
      }

      issues.push("DPS below potential");
      recommendations.push("Check rotation optimization");
      recommendations.push("Ensure buffs and consumables are active");
      recommendations.push("Review talent choices");

      bottlenecks.push({
        botId: bot.botId,
        botName: bot.name,
        currentDps: botCurrentDps,
        potentialDps: expectedDps,
        issues,
        recommendations
      });
    }
  }

  const groupOptimizations: string[] = [];

  if (currentDps < potentialDps * 0.9) {
    groupOptimizations.push("Coordinate cooldown usage for burst windows");
    groupOptimizations.push("Ensure group buffs (Bloodlust, etc.) are used");
    groupOptimizations.push("Optimize target priority and focus fire");
  }

  return {
    groupId: "group_" + Date.now(),
    currentDps,
    potentialDps,
    dpsGap: potentialDps - currentDps,
    bottlenecks,
    groupOptimizations
  };
}

/**
 * Create formation strategy
 */
export function createFormation(
  bots: BotInfo[],
  formationType: FormationStrategy["formationType"],
  centerPoint: { x: number; y: number; z: number }
): FormationStrategy {
  const positions: FormationStrategy["positions"] = [];
  const spacing = 8; // 8 yards between bots

  switch (formationType) {
    case "spread":
      // Spread formation - everyone at different angles
      bots.forEach((bot, i) => {
        const angle = (i / bots.length) * Math.PI * 2;
        const distance = bot.role === "tank" ? 5 : bot.role.includes("dps") && bot.role.includes("melee") ? 8 : 20;

        positions.push({
          botId: bot.botId,
          role: bot.role,
          x: centerPoint.x + Math.cos(angle) * distance,
          y: centerPoint.y + Math.sin(angle) * distance,
          z: centerPoint.z,
          facing: Math.atan2(centerPoint.y - (centerPoint.y + Math.sin(angle) * distance),
            centerPoint.x - (centerPoint.x + Math.cos(angle) * distance))
        });
      });
      break;

    case "stack":
      // Stack formation - everyone close together
      positions.push({
        botId: bots[0]?.botId || "unknown",
        role: bots[0]?.role || "unknown",
        x: centerPoint.x,
        y: centerPoint.y,
        z: centerPoint.z,
        facing: 0
      });

      bots.slice(1).forEach((bot, i) => {
        const angle = (i / (bots.length - 1)) * Math.PI * 2;
        positions.push({
          botId: bot.botId,
          role: bot.role,
          x: centerPoint.x + Math.cos(angle) * 2,
          y: centerPoint.y + Math.sin(angle) * 2,
          z: centerPoint.z,
          facing: 0
        });
      });
      break;

    case "line":
      // Line formation
      bots.forEach((bot, i) => {
        positions.push({
          botId: bot.botId,
          role: bot.role,
          x: centerPoint.x + (i * spacing),
          y: centerPoint.y,
          z: centerPoint.z,
          facing: 0
        });
      });
      break;

    default:
      // Default to spread
      break;
  }

  return {
    formationType,
    positions,
    spacing,
    centerPoint,
    purpose: getPurpose(formationType)
  };
}

/**
 * Coordinate resources across group
 */
export function coordinateResources(bots: BotInfo[]): ResourceCoordination {
  const resources: ResourceCoordination["resources"] = [];
  const healerMana: ResourceCoordination["healerMana"] = [];
  const tankThreat: ResourceCoordination["tankThreat"] = [];

  for (const bot of bots) {
    const regenRate = getResourceRegenRate(bot);
    const consumptionRate = getResourceConsumptionRate(bot);
    const timeToEmpty = consumptionRate > regenRate
      ? bot.power / (consumptionRate - regenRate)
      : 999999;

    const isBottleneck = timeToEmpty < 60; // Less than 60 seconds

    resources.push({
      botId: bot.botId,
      botName: bot.name,
      resourceType: bot.powerType,
      current: bot.power,
      max: bot.maxPower,
      regenRate,
      consumptionRate,
      timeToEmpty,
      isBottleneck
    });

    // Track healer mana specifically
    if (bot.role === "healer") {
      const manaPercent = (bot.power / bot.maxPower) * 100;
      const timeToOom = timeToEmpty;

      let recommendation = "Mana healthy";
      if (manaPercent < 30) {
        recommendation = "CRITICAL: Use mana potion or Innervate";
      } else if (manaPercent < 50) {
        recommendation = "Consider mana conservation";
      }

      healerMana.push({
        healerId: bot.botId,
        healerName: bot.name,
        manaPercent,
        timeToOom,
        recommendation
      });
    }

    // Track tank threat
    if (bot.role === "tank") {
      // Calculate threat based on tank DPS and threat modifiers
      // Tanks generate threat = damage * threat_modifier (usually 4-6x for tank specs)
      const tankDps = estimateDpsFromItemLevel(bot.itemLevel, "tank");
      const threatModifier = 5.0; // Tank stance/spec gives ~500% threat
      const tps = tankDps * threatModifier;

      // Estimate current threat (accumulated over ~30 seconds of combat)
      const threat = tps * 30;

      // Tank is stable if they generate enough threat to hold aggro
      // Typically need 110% of DPS threat to maintain aggro
      const totalGroupDps = bots
        .filter(b => b.role.includes("dps"))
        .reduce((sum, b) => sum + estimateDpsFromItemLevel(b.itemLevel, b.role), 0);
      const requiredTps = totalGroupDps * 1.1;
      const isStable = tps >= requiredTps;

      tankThreat.push({
        tankId: bot.botId,
        tankName: bot.name,
        threat,
        tps,
        isStable
      });
    }
  }

  return {
    groupId: "group_" + Date.now(),
    resources,
    healerMana,
    tankThreat
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getMajorCooldown(classId: number): number {
  const cooldowns: { [key: number]: number } = {
    1: 107574, // Warrior - Avatar
    2: 31884, // Paladin - Avenging Wrath
    3: 19574, // Hunter - Bestial Wrath
    4: 13750, // Rogue - Adrenaline Rush
    5: 10060, // Priest - Power Infusion
    6: 49206, // DK - Summon Gargoyle
    7: 114050, // Shaman - Ascendance
    8: 12472, // Mage - Icy Veins
    9: 113858, // Warlock - Dark Soul
    10: 137639, // Monk - Storm, Earth, and Fire
    11: 106951, // Druid - Berserk
    12: 191427, // DH - Metamorphosis
    13: 357208 // Evoker - Fire Breath
  };

  return cooldowns[classId] || 0;
}

function getMajorCooldownName(classId: number): string {
  const names: { [key: number]: string } = {
    1: "Avatar",
    2: "Avenging Wrath",
    3: "Bestial Wrath",
    4: "Adrenaline Rush",
    5: "Power Infusion",
    6: "Summon Gargoyle",
    7: "Ascendance",
    8: "Icy Veins",
    9: "Dark Soul",
    10: "Storm, Earth, and Fire",
    11: "Berserk",
    12: "Metamorphosis",
    13: "Fire Breath"
  };

  return names[classId] || "Major Cooldown";
}

function hasInterruptAbility(classId: number): boolean {
  // All classes have interrupts in modern WoW except maybe some healers
  return ![5].includes(classId); // Priest has limited interrupt
}

function getCCAbility(classId: number): string {
  const ccAbilities: { [key: number]: string } = {
    1: "Storm Bolt",
    2: "Hammer of Justice",
    3: "Freezing Trap",
    4: "Kidney Shot",
    5: "Psychic Scream",
    6: "Asphyxiate",
    7: "Hex",
    8: "Polymorph",
    9: "Fear",
    10: "Paralysis",
    11: "Cyclone",
    12: "Chaos Nova",
    13: "Sleep Walk"
  };

  return ccAbilities[classId] || "CC";
}

function estimateDpsFromItemLevel(itemLevel: number, role: string): number {
  // Handle tank role separately (lower DPS)
  if (role === "tank") {
    const baseDps = 20000;
    const dpsPerIlvl = 350;
    return baseDps + ((itemLevel - 450) * dpsPerIlvl);
  }

  if (!role.includes("dps")) return 0;

  // Rough DPS estimation (WoW 11.2 values)
  const baseDps = 30000;
  const dpsPerIlvl = 500;

  return baseDps + ((itemLevel - 450) * dpsPerIlvl);
}

function estimateHpsFromItemLevel(itemLevel: number): number {
  // Healer HPS estimation (WoW 11.2 values)
  // HPS scales with intellect and secondary stats
  const baseHps = 25000;
  const hpsPerIlvl = 450;

  return baseHps + ((itemLevel - 450) * hpsPerIlvl);
}

function getResourceRegenRate(bot: BotInfo): number {
  // WoW 11.2 resource regeneration rates
  const powerType = bot.powerType.toLowerCase();

  switch (powerType) {
    case "mana":
      // Mana regen = Base regen * (1 + Spirit/SpiritToRegen) * MP5_items
      // Simplified: ~1-2% of max mana per second (depending on spirit)
      // Combat regen is 50% of out-of-combat regen
      const baseManaRegen = bot.maxPower * 0.015;
      return baseManaRegen;

    case "energy":
      // Rogues and Druids (Cat Form): 10 energy per second base
      return 10;

    case "rage":
      // Warriors and Druids (Bear Form): Generated by damage taken/dealt
      // ~2-3 rage per second from auto-attacks, more from abilities
      return 2.5;

    case "focus":
      // Hunters: 5 focus per second base
      return 5;

    case "runic_power":
      // Death Knights: Generated by abilities (Frost Strike, etc.)
      // Average ~10-15 RP per second during rotation
      return 12;

    case "fury":
      // Demon Hunters: Rage-like resource, generated by abilities
      return 8;

    case "astral_power":
      // Balance Druids: Generated by spells
      return 0; // Generated by rotation, not passive

    case "maelstrom":
      // Enhancement Shamans: Generated by abilities
      return 0; // Generated by rotation

    case "insanity":
      // Shadow Priests: Generated by Mind Flay/Blast
      return 0; // Generated by rotation

    case "chi":
      // Monks: Generated by abilities
      return 0; // Generated by rotation

    case "holy_power":
      // Paladins: Generated by abilities
      return 0; // Generated by rotation

    case "soul_shards":
      // Warlocks: Generated by abilities
      return 0; // Generated by rotation

    case "arcane_charges":
      // Arcane Mages: Generated by Arcane Blast
      return 0; // Generated by rotation

    default:
      return 0;
  }
}

function getResourceConsumptionRate(bot: BotInfo): number {
  // Resource consumption rates based on role and rotation intensity
  const powerType = bot.powerType.toLowerCase();

  // Mana-based classes
  if (powerType === "mana") {
    if (bot.role === "healer") {
      // Healers: High consumption during intense healing (1.5-2.5% per second)
      return bot.maxPower * 0.020; // ~50 seconds to OOM under heavy load
    } else if (bot.role.includes("dps")) {
      // Casters: Moderate consumption (0.8-1.2% per second)
      return bot.maxPower * 0.010; // ~100 seconds to OOM
    } else {
      // Tanks with mana: Low consumption
      return bot.maxPower * 0.005;
    }
  }

  // Energy-based (Rogues, Feral Druids)
  if (powerType === "energy") {
    // Energy is capped at 100/120, consumed by finishers and builders
    // Average consumption: ~30-40 energy per 3-second cycle
    return 12; // Energy per second average
  }

  // Rage-based (Warriors, Guardian Druids)
  if (powerType === "rage") {
    // Rage is spent on abilities, capped at 100
    // Consumption matches generation in steady state
    return 8; // Rage per second average
  }

  // Focus (Hunters)
  if (powerType === "focus") {
    // Focus: Capped at 120, consumed by focus dumps
    // Average consumption: ~30-40 focus per 3-second cycle
    return 10; // Focus per second average
  }

  // Runic Power (Death Knights)
  if (powerType === "runic_power") {
    // Runic Power: Capped at 100/125, consumed by spenders
    return 15; // RP per second average
  }

  // Other resource types are typically capped and don't deplete like mana
  return 0;
}

function getPurpose(formationType: string): string {
  const purposes: { [key: string]: string } = {
    "spread": "Avoid AoE damage and spread mechanics",
    "stack": "Share healing and buffs, stack for AoE heals",
    "line": "Organized positioning for movement",
    "circle": "Surround target, good for kiting",
    "wedge": "Aggressive push formation"
  };

  return purposes[formationType] || "Tactical positioning";
}
