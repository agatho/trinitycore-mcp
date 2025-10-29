/**
 * PvP Arena/Battleground Tactician MCP
 *
 * Provides comprehensive PvP strategy, arena compositions, battleground tactics,
 * counter-play analysis, and rated PvP optimization for WoW 11.2.
 *
 * @module pvptactician
 */

import { queryWorld } from "../database/connection";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ArenaComposition {
  bracket: "2v2" | "3v3" | "5v5" | "solo_shuffle";
  team: TeamMember[];
  rating: number;
  tier: "glad" | "duelist" | "rival" | "challenger" | "combatant";
  strengths: string[];
  weaknesses: string[];
  counterComps: string[];
  winCondition: string;
  loseCondition: string;
}

export interface TeamMember {
  role: "dps" | "healer" | "hybrid";
  classId: number;
  className: string;
  specId: number;
  specName: string;
  pvpTalents: number[];
  gearScore: number;
}

export interface ArenaStrategy {
  composition: string;
  openingPlay: string;
  targetPriority: string[];
  cooldownUsage: CooldownPhase[];
  positioning: string;
  winConditions: string[];
  counterStrategies: Array<{
    vsComp: string;
    strategy: string;
    focus: string;
  }>;
}

export interface CooldownPhase {
  phase: "opener" | "pressure" | "defensive" | "reset" | "finish";
  timing: string;
  cooldowns: Array<{
    player: string;
    ability: string;
    purpose: string;
  }>;
  coordination: string;
}

export interface BattlegroundStrategy {
  bgId: number;
  bgName: string;
  type: "capture_flag" | "control_points" | "resource_race" | "assault";
  playerCount: number;
  duration: number;
  objectives: BGObjective[];
  strategy: string;
  roleAssignments: Array<{
    role: string;
    classes: string[];
    responsibility: string;
  }>;
  mapControl: MapControlPoint[];
  timingWindows: Array<{
    time: string;
    action: string;
    priority: "critical" | "high" | "medium";
  }>;
}

export interface BGObjective {
  id: string;
  name: string;
  type: "flag" | "base" | "node" | "resource" | "boss";
  location: { x: number; y: number };
  priority: number;
  captureTime: number;
  defenders: number;
  points: number;
}

export interface MapControlPoint {
  name: string;
  importance: "critical" | "high" | "medium" | "low";
  reason: string;
  contestable: boolean;
}

export interface PvPTalentBuild {
  specId: number;
  bracket: "2v2" | "3v3" | "5v5" | "rbg" | "solo_shuffle";
  pvpTalents: Array<{
    tier: number;
    talentId: number;
    talentName: string;
    reason: string;
  }>;
  regularTalents: number[];
  score: number;
  meta: "S" | "A" | "B" | "C";
}

export interface TargetPriority {
  situation: string;
  targets: Array<{
    priority: number;
    target: string;
    reason: string;
    killability: "easy" | "medium" | "hard" | "impossible";
    threat: number;
  }>;
}

export interface CooldownTrade {
  enemyCooldown: string;
  counterCooldowns: string[];
  timing: string;
  importance: "critical" | "high" | "medium" | "low";
  consequence: string;
}

export interface SoloShuffleStrategy {
  round: number;
  totalRounds: 6;
  partner: TeamMember;
  enemies: TeamMember[];
  strategy: string;
  focus: string;
  survivalPriority: "high" | "medium" | "low";
  damageWindow: string;
}

export interface RatedPvPClimbPlan {
  currentRating: number;
  targetRating: number;
  bracket: string;
  estimatedGames: number;
  winRateNeeded: number;
  compositionSuggestions: string[];
  weeklyPlan: Array<{
    week: number;
    targetRating: number;
    gamesPerWeek: number;
    focus: string;
  }>;
}

export interface BlitzBGStrategy {
  bgName: string;
  fastPaced: boolean;
  objectivePriority: string[];
  quickRotation: boolean;
  teamSplit: Array<{
    group: string;
    members: number;
    objective: string;
  }>;
  timeLimit: number;
}

// ============================================================================
// ARENA COMPOSITION ANALYSIS
// ============================================================================

/**
 * Analyze arena team composition
 */
export function analyzeArenaComposition(
  bracket: ArenaComposition["bracket"],
  team: TeamMember[],
  rating: number
): ArenaComposition {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const counterComps: string[] = [];

  // Analyze team balance
  const dpsCount = team.filter(m => m.role === "dps").length;
  const healerCount = team.filter(m => m.role === "healer").length;

  // Bracket-specific analysis
  if (bracket === "2v2") {
    if (healerCount === 1 && dpsCount === 1) {
      strengths.push("Standard healer/DPS comp - sustainable");
    } else if (dpsCount === 2) {
      strengths.push("Double DPS - high burst potential");
      weaknesses.push("No sustain - must win fast");
    }
  } else if (bracket === "3v3") {
    if (healerCount === 1 && dpsCount === 2) {
      strengths.push("Standard 3v3 comp - balanced");
    }
    if (healerCount === 0) {
      weaknesses.push("No healer - extremely vulnerable");
    }
  }

  // Check class synergies
  const classNames = team.map(m => m.className);
  if (classNames.includes("Mage") && classNames.includes("Rogue")) {
    strengths.push("Rogue/Mage synergy - strong CC chains");
  }
  if (classNames.includes("Warrior") && classNames.includes("Priest")) {
    strengths.push("Warrior/Priest - classic synergy");
  }

  // Determine tier based on rating
  let tier: ArenaComposition["tier"] = "combatant";
  if (rating >= 2400) tier = "glad";
  else if (rating >= 2100) tier = "duelist";
  else if (rating >= 1800) tier = "rival";
  else if (rating >= 1400) tier = "challenger";

  // Win/lose conditions
  const winCondition = healerCount > 0
    ? "Control tempo, land CC chains, secure kills during burst windows"
    : "Aggressive opener, land kill before defensive cooldowns rotate";

  const loseCondition = healerCount > 0
    ? "Healer goes OOM, lose cooldown trades, get separated"
    : "Fail to secure early kill, take too much damage";

  return {
    bracket,
    team,
    rating,
    tier,
    strengths,
    weaknesses,
    counterComps,
    winCondition,
    loseCondition
  };
}

/**
 * Get arena strategy for composition
 */
export function getArenaStrategy(composition: string, bracket: string): ArenaStrategy {
  // Predefined strategies for common compositions
  const strategies: { [key: string]: ArenaStrategy } = {
    "rmp": { // Rogue/Mage/Priest
      composition: "RMP (Rogue/Mage/Priest)",
      openingPlay: "Rogue saps healer, open on kill target with Mage sheep for cross-CC",
      targetPriority: ["Healer if sappable", "Squishy DPS", "Tank last"],
      cooldownUsage: [
        {
          phase: "opener",
          timing: "0-30 seconds",
          cooldowns: [
            { player: "Rogue", ability: "Shadow Blades", purpose: "Burst damage on opener" },
            { player: "Mage", ability: "Icy Veins", purpose: "Coordinated burst" }
          ],
          coordination: "Chain CC on healer, pressure kill target"
        }
      ],
      positioning: "Pillar kiting when defensive, aggressive when offensive",
      winConditions: [
        "Land kill during CC chain on healer",
        "Force major defensive cooldowns, reset, repeat",
        "OOM enemy healer through sustained pressure"
      ],
      counterStrategies: [
        {
          vsComp: "TSG (Warrior/DK/Healer)",
          strategy: "Kite melee, sheep off-target, focus on CC chains",
          focus: "Avoid getting trained, control with CC"
        }
      ]
    },
    "jungle": { // Hunter/Feral/Healer
      composition: "Jungle Cleave (Hunter/Feral/Healer)",
      openingPlay: "Hunter opens with freezing trap on healer, coordinate burst on kill target",
      targetPriority: ["Squishy casters", "Healer", "Melee last"],
      cooldownUsage: [
        {
          phase: "opener",
          timing: "0-20 seconds",
          cooldowns: [
            { player: "Hunter", ability: "Bestial Wrath", purpose: "Immune to CC during burst" },
            { player: "Feral", ability: "Berserk", purpose: "Maximum burst damage" }
          ],
          coordination: "Trap healer, both DPS burst same target"
        }
      ],
      positioning: "Maintain distance for Hunter, Feral pressures healer",
      winConditions: [
        "Secure kill during initial burst window",
        "Control healer with traps and CC",
        "Maintain uptime with mobility"
      ],
      counterStrategies: []
    }
  };

  return strategies[composition.toLowerCase()] || {
    composition: "Generic Composition",
    openingPlay: "Coordinate burst on primary target",
    targetPriority: ["Healer", "Squishy DPS", "Tank"],
    cooldownUsage: [],
    positioning: "Use line of sight, pillar kiting when pressured",
    winConditions: ["Outlast enemy cooldowns", "Secure kills during windows"],
    counterStrategies: []
  };
}

/**
 * Get target priority for arena situation
 */
export function getTargetPriority(
  situation: string,
  enemies: TeamMember[]
): TargetPriority {
  const targets: TargetPriority["targets"] = [];

  for (const enemy of enemies) {
    let priority = 0;
    let killability: "easy" | "medium" | "hard" | "impossible" = "medium";
    let threat = 5;
    let reason = "";

    // Healers are always high priority
    if (enemy.role === "healer") {
      priority = 8;
      killability = "hard";
      threat = 9;
      reason = "Healer - must control or kill to secure wins";
    }

    // Squishy DPS
    if (enemy.role === "dps" && ["Mage", "Warlock", "Hunter", "Priest"].includes(enemy.className)) {
      priority = 7;
      killability = "easy";
      threat = 7;
      reason = "Squishy DPS - vulnerable to burst";
    }

    // Tanky melee
    if (["Warrior", "Death Knight", "Paladin"].includes(enemy.className)) {
      priority = 4;
      killability = "hard";
      threat = 6;
      reason = "Tanky melee - difficult to kill but threatens pressure";
    }

    targets.push({
      priority,
      target: `${enemy.className} (${enemy.specName})`,
      reason,
      killability,
      threat
    });
  }

  return {
    situation,
    targets: targets.sort((a, b) => b.priority - a.priority)
  };
}

/**
 * Get PvP talent build for spec and bracket
 */
export function getPvPTalentBuild(
  specId: number,
  bracket: PvPTalentBuild["bracket"]
): PvPTalentBuild {
  // Example builds for common specs
  const builds: { [key: string]: PvPTalentBuild } = {
    "64_3v3": { // Frost Mage 3v3
      specId: 64,
      bracket: "3v3",
      pvpTalents: [
        { tier: 1, talentId: 5497, talentName: "Ice Form", reason: "Immunity to stuns/knockbacks" },
        { tier: 2, talentId: 5491, talentName: "Ring of Frost", reason: "AOE CC for peel" },
        { tier: 3, talentId: 3517, talentName: "Polymorph", reason: "Long CC chain potential" }
      ],
      regularTalents: [],
      score: 95,
      meta: "S"
    }
  };

  const buildKey = `${specId}_${bracket}`;
  return builds[buildKey] || {
    specId,
    bracket,
    pvpTalents: [],
    regularTalents: [],
    score: 70,
    meta: "B"
  };
}

// ============================================================================
// BATTLEGROUND STRATEGIES
// ============================================================================

/**
 * Get battleground strategy
 */
export async function getBattlegroundStrategy(bgId: number): Promise<BattlegroundStrategy> {
  // Query BG info from database
  const query = `
    SELECT map, maxPlayers FROM battleground_template WHERE id = ?
  `;

  const results = await queryWorld(query, [bgId]);

  const bgStrategies: { [key: number]: Partial<BattlegroundStrategy> } = {
    2: { // Warsong Gulch
      bgName: "Warsong Gulch",
      type: "capture_flag",
      playerCount: 10,
      duration: 25,
      objectives: [
        {
          id: "alliance_flag",
          name: "Alliance Flag",
          type: "flag",
          location: { x: 0, y: 0 },
          priority: 10,
          captureTime: 0,
          defenders: 3,
          points: 1
        },
        {
          id: "horde_flag",
          name: "Horde Flag",
          type: "flag",
          location: { x: 0, y: 0 },
          priority: 10,
          captureTime: 0,
          defenders: 3,
          points: 1
        }
      ],
      strategy: "3-3-4 split: 3 offense, 3 defense, 4 mid control. Capture enemy flag while defending yours.",
      roleAssignments: [
        {
          role: "Flag Carrier",
          classes: ["Druid", "Monk", "Demon Hunter"],
          responsibility: "Grab flag, survive, return to base"
        },
        {
          role: "Defense",
          classes: ["Any with CC/peel"],
          responsibility: "Protect flag room, call out enemy EFC"
        },
        {
          role: "Offense",
          classes: ["High burst DPS"],
          responsibility: "Kill enemy flag carrier, secure flag"
        },
        {
          role: "Mid Control",
          classes: ["AOE damage, CC"],
          responsibility: "Control midfield, support as needed"
        }
      ],
      mapControl: [
        {
          name: "Midfield",
          importance: "high",
          reason: "Controls movement between bases",
          contestable: true
        },
        {
          name: "Tunnel/Ramp",
          importance: "medium",
          reason: "Alternate routes for flag runs",
          contestable: true
        }
      ],
      timingWindows: [
        {
          time: "0:00-2:00",
          action: "Initial flag grab, establish positions",
          priority: "critical"
        },
        {
          time: "2:00-20:00",
          action: "Execute strategy, adapt to enemy",
          priority: "high"
        },
        {
          time: "20:00+",
          action: "Final push if ahead, desperate plays if behind",
          priority: "critical"
        }
      ]
    },
    3: { // Arathi Basin
      bgName: "Arathi Basin",
      type: "control_points",
      playerCount: 15,
      duration: 25,
      objectives: [
        { id: "stable", name: "Stables", type: "base", location: { x: 0, y: 0 }, priority: 8, captureTime: 60, defenders: 2, points: 10 },
        { id: "lumber", name: "Lumber Mill", type: "base", location: { x: 0, y: 0 }, priority: 7, captureTime: 60, defenders: 2, points: 10 },
        { id: "mine", name: "Gold Mine", type: "base", location: { x: 0, y: 0 }, priority: 9, captureTime: 60, defenders: 2, points: 10 },
        { id: "farm", name: "Farm", type: "base", location: { x: 0, y: 0 }, priority: 8, captureTime: 60, defenders: 2, points: 10 },
        { id: "blacksmith", name: "Blacksmith", type: "base", location: { x: 0, y: 0 }, priority: 10, captureTime: 60, defenders: 3, points: 10 }
      ],
      strategy: "Control 3 bases (usually Farm, Blacksmith, Lumber for Alliance; Mine, Blacksmith, Stables for Horde). Defend 3, contest 2.",
      roleAssignments: [
        {
          role: "Base Defense",
          classes: ["Any class with survivability"],
          responsibility: "Call incs, delay captures, defend 3 bases"
        },
        {
          role: "Assault Team",
          classes: ["Burst DPS, CC"],
          responsibility: "Capture contested bases, respond to threats"
        }
      ],
      mapControl: [
        {
          name: "Blacksmith",
          importance: "critical",
          reason: "Central base, controls map flow",
          contestable: true
        }
      ],
      timingWindows: []
    }
  };

  const bgData = bgStrategies[bgId];

  if (!bgData) {
    throw new Error(`Battleground ${bgId} strategy not found`);
  }

  return {
    bgId,
    bgName: bgData.bgName || "Unknown BG",
    type: bgData.type || "control_points",
    playerCount: bgData.playerCount || 10,
    duration: bgData.duration || 25,
    objectives: bgData.objectives || [],
    strategy: bgData.strategy || "Capture objectives and win",
    roleAssignments: bgData.roleAssignments || [],
    mapControl: bgData.mapControl || [],
    timingWindows: bgData.timingWindows || []
  };
}

/**
 * Get Solo Shuffle strategy
 */
export function getSoloShuffleStrategy(
  round: number,
  partner: TeamMember,
  enemies: TeamMember[]
): SoloShuffleStrategy {
  // Analyze partner synergy
  const isHealerPartner = partner.role === "healer";

  let strategy = "";
  let focus = "";
  let survivalPriority: SoloShuffleStrategy["survivalPriority"] = "medium";

  if (isHealerPartner) {
    strategy = "Play with healer partner - focus on survival and sustained damage";
    focus = "Identify kill target, land CC chains, secure kill during window";
    survivalPriority = "medium";
  } else {
    strategy = "Double DPS comp - aggressive opener required";
    focus = "Land kill in first 30 seconds before defensive cooldowns rotate";
    survivalPriority = "low";
  }

  const enemyHealer = enemies.find(e => e.role === "healer");

  if (!enemyHealer) {
    strategy += ". Enemy has no healer - match aggression or win slowly";
  }

  return {
    round,
    totalRounds: 6,
    partner,
    enemies,
    strategy,
    focus,
    survivalPriority,
    damageWindow: isHealerPartner ? "Sustained pressure with burst windows" : "All-in opener"
  };
}

/**
 * Get Blitz BG strategy
 */
export function getBlitzBGStrategy(bgName: string): BlitzBGStrategy {
  return {
    bgName,
    fastPaced: true,
    objectivePriority: [
      "Secure initial objectives quickly",
      "Rotate to next objective immediately",
      "Avoid prolonged fights"
    ],
    quickRotation: true,
    teamSplit: [
      {
        group: "Alpha",
        members: 4,
        objective: "Primary objective capture"
      },
      {
        group: "Bravo",
        members: 4,
        objective: "Secondary objective/defense"
      },
      {
        group: "Flex",
        members: 2,
        objective: "Respond to threats, support groups"
      }
    ],
    timeLimit: 10
  };
}

/**
 * Get cooldown trading recommendations
 */
export function getCooldownTrades(): CooldownTrade[] {
  return [
    {
      enemyCooldown: "Combustion (Mage)",
      counterCooldowns: ["Defensive CD", "CC the Mage", "Line of Sight"],
      timing: "Immediate response required",
      importance: "critical",
      consequence: "Death if not countered"
    },
    {
      enemyCooldown: "Avatar (Warrior)",
      counterCooldowns: ["Kiting", "Disarm", "Major Defensive"],
      timing: "Counter within 5 seconds",
      importance: "high",
      consequence: "Heavy pressure, potential death"
    },
    {
      enemyCooldown: "Vendetta (Rogue)",
      counterCooldowns: ["Shield Wall", "Immunity", "Dispersion"],
      timing: "Respond immediately",
      importance: "critical",
      consequence: "Rogue will try to land kill"
    }
  ];
}

/**
 * Get rated PvP climb plan
 */
export function getRatedPvPClimbPlan(
  currentRating: number,
  targetRating: number,
  bracket: string
): RatedPvPClimbPlan {
  const ratingGap = targetRating - currentRating;
  const avgMMRGain = 15; // Average MMR per win
  const estimatedGames = Math.ceil(ratingGap / avgMMRGain);
  const winRateNeeded = 55; // 55% winrate needed to climb

  const weeks = Math.ceil(estimatedGames / 50); // 50 games per week estimate

  const weeklyPlan: RatedPvPClimbPlan["weeklyPlan"] = [];
  for (let i = 1; i <= weeks; i++) {
    const weekRating = currentRating + ((ratingGap / weeks) * i);
    weeklyPlan.push({
      week: i,
      targetRating: Math.round(weekRating),
      gamesPerWeek: 50,
      focus: i === 1 ? "Establish baseline, identify weaknesses" :
        i === weeks ? "Final push to target" :
          "Consistent improvement, refine execution"
    });
  }

  return {
    currentRating,
    targetRating,
    bracket,
    estimatedGames,
    winRateNeeded,
    compositionSuggestions: [
      "Find reliable partners with similar goals",
      "Play meta compositions when possible",
      "Master 2-3 comps rather than playing everything"
    ],
    weeklyPlan
  };
}

/**
 * Analyze counter-composition matchup
 */
export function analyzeCounterMatchup(
  yourComp: string,
  enemyComp: string
): {
  favored: "you" | "enemy" | "even";
  favorability: number;
  strategy: string;
  keyPoints: string[];
} {
  // Comprehensive WoW 11.2 (The War Within) 3v3 Arena composition counter matrix
  // Favorability scale: -50 (hard counter) to +50 (heavily favored)
  const counters: { [key: string]: { [key: string]: { favorability: number; strategy: string; keyPoints: string[] } } } = {
    "rmp": { // Rogue/Mage/Priest (Control)
      "tsg": { favorability: -25, strategy: "Survive pressure, reset often, kite warrior", keyPoints: ["Poly Healer during stuns", "Use all resets", "Rogue peels DK/Warrior", "Don't over-extend"] },
      "jungle": { favorability: 20, strategy: "Control feral, pressure healer", keyPoints: ["Sheep Druid repeatedly", "Rogue on Hunter", "Priest fears on cooldown", "Play aggressive"] },
      "rmp": { favorability: 0, strategy: "Mirror match - cc chain and mana pressure", keyPoints: ["Drink when safe", "Land more sheep", "Coordinate cc chains", "Mana management crucial"] },
      "god": { favorability: -15, strategy: "Avoid hunter cc chains, pressure druid healer", keyPoints: ["Dodge traps", "Priest dispels important", "Kite melee", "Long game favors you"] },
      "walking_dead": { favorability: -20, strategy: "Kite DKs, survive burst", keyPoints: ["Use all cooldowns", "Reset constantly", "Priest mana crucial", "Play defensive"] },
      "cupid": { favorability: 10, strategy: "Control hunter, pressure priest", keyPoints: ["Sheep Priest when possible", "Dodge traps", "Rogue on Hunter", "Mana pressure wins"] },
      "thug": { favorability: -10, strategy: "Survive warrior/rogue pressure", keyPoints: ["Save defensives", "Poly healer in stuns", "Priest dispels critical", "Don't sit cc"] }
    },
    "jungle": { // Hunter/Feral/Resto Druid (Cleave)
      "rmp": { favorability: -20, strategy: "Avoid cc chains, pressure mage", keyPoints: ["Kick sheep", "Hunter traps crucial", "Feral pressures priest", "Don't feed cc"] },
      "tsg": { favorability: 15, strategy: "Kite and control, sustained damage", keyPoints: ["Trap warrior in charge", "Root DK often", "Druid peels important", "Outlast them"] },
      "jungle": { favorability: 0, strategy: "Mirror - trap battles", keyPoints: ["Better traps win", "Feral vs Feral", "Druid positioning", "Patience key"] },
      "god": { favorability: 5, strategy: "Mirror hunter control", keyPoints: ["Trap battles", "Feral pressure on Druid", "Counter-cc important", "Sustained damage"] },
      "cupid": { favorability: -10, strategy: "Survive hunter pressure, control priest", keyPoints: ["Dodge traps", "Kick heals", "Root hunter when trapped", "Damage race"] }
    },
    "tsg": { // Warrior/DK/Healer (Melee cleave)
      "rmp": { favorability: 25, strategy: "Pressure early, don't give resets", keyPoints: ["Train Priest hard", "DK grips on resets", "Kick important heals", "Maintain pressure"] },
      "jungle": { favorability: -15, strategy: "Train feral, interrupt druid", keyPoints: ["Stick to Feral", "Kick clones", "Grip kiting targets", "Don't overextend"] },
      "tsg": { favorability: 0, strategy: "Mirror melee pressure", keyPoints: ["Train enemy healer", "Interrupt efficiency", "Use grips wisely", "Defensive CD usage"] },
      "god": { favorability: -20, strategy: "Survive kiting, land grips", keyPoints: ["DK grips on Hunter", "Train Druid healer", "Warrior hamstring uptime", "Don't chase forever"] },
      "walking_dead": { favorability: 10, strategy: "DK pressure wins", keyPoints: ["Train enemy healer", "Coordinate stuns", "Use all CDs", "Mana burn healer"] }
    },
    "god": { // Hunter/DK/Resto Druid (Control/Cleave)
      "rmp": { favorability: 15, strategy: "Trap rogue, control with cc", keyPoints: ["Trap during go", "Grip mage/priest", "DK pressure on Priest", "Druid survives cc"] },
      "jungle": { favorability: -5, strategy: "Mirror matchup, trap battles", keyPoints: ["Better traps", "DK on enemy Druid", "Hunter control", "Don't waste grips"] },
      "tsg": { favorability: 20, strategy: "Kite warrior, control with hunter", keyPoints: ["Trap Warrior charges", "Root melee often", "Druid kites well", "Hunter pressure steady"] },
      "cupid": { favorability: 5, strategy: "Hunter vs Hunter control", keyPoints: ["Trap first", "DK on Priest", "Counter-trap important", "Patience wins"] }
    },
    "walking_dead": { // DK/DK/Healer (Double DK)
      "rmp": { favorability: 20, strategy: "Constant pressure, grip resets", keyPoints: ["Grip on every reset", "Train Priest", "AMZ for combust", "Never let them breathe"] },
      "tsg": { favorability: -10, strategy: "DK vs DK, control warrior", keyPoints: ["Grip enemy DK", "Control Warrior", "Healer survival key", "Trade defensives"] }
    },
    "cupid": { // Hunter/Priest/X (Control)
      "rmp": { favorability: -10, strategy: "Avoid cc chains, pressure priest", keyPoints: ["Dodge traps", "Train enemy Priest", "Hunter kiting", "Long game risky"] },
      "jungle": { favorability: 10, strategy: "Control feral, priest survives", keyPoints: ["Fear Druid", "Trap Feral", "Priest mana advantage", "Sustained pressure"] },
      "god": { favorability: -5, strategy: "Hunter battles, priest mana", keyPoints: ["Trap first", "Priest mana crucial", "Don't sit cc", "Play patient"] }
    },
    "thug": { // Rogue/Warrior/Healer (Melee cleave)
      "rmp": { favorability: 10, strategy: "Melee pressure on priest", keyPoints: ["Rogue on Priest", "Warrior pressure Mage", "Kick important heals", "Don't feed cc chains"] },
      "tsg": { favorability: -5, strategy: "Warrior vs Warrior, rogue control", keyPoints: ["Rogue on healer", "Warrior peels DK", "Save CDs", "Trade pressure"] }
    },
    "shadowplay": { // Warlock/Shadow Priest/Healer (Caster cleave)
      "rmp": { favorability: 15, strategy: "Rot damage, mana pressure", keyPoints: ["Warlock spreads dots", "Shadow fears/silences", "Outlast them", "Mana game"] },
      "tsg": { favorability: -20, strategy: "Survive melee pressure, kite", keyPoints: ["Gateway escapes", "Fear train target", "Port/Gateway resets", "Use all defensives"] },
      "jungle": { favorability: 10, strategy: "Control feral, rot team", keyPoints: ["Fear Druid", "Dots on everyone", "Shadow on Feral", "Sustained damage"] }
    }
  };

  const yourCompLower = yourComp.toLowerCase();
  const enemyCompLower = enemyComp.toLowerCase();

  const matchup = counters[yourCompLower]?.[enemyCompLower];

  if (matchup) {
    let favored: "you" | "enemy" | "even" = "even";
    if (matchup.favorability > 10) favored = "you";
    else if (matchup.favorability < -10) favored = "enemy";

    return {
      favored,
      favorability: matchup.favorability,
      strategy: matchup.strategy,
      keyPoints: matchup.keyPoints
    };
  }

  // Fallback for unknown matchups
  const favorability = 0;

  let favored: "you" | "enemy" | "even" = "even";

  return {
    favored,
    favorability,
    strategy: favored === "you"
      ? "Play standard game plan, you have advantage"
      : favored === "enemy"
        ? "Adjust strategy to mitigate disadvantage"
        : "Skill matchup - execution determines winner",
    keyPoints: [
      "Control tempo of the match",
      "Land CC chains on priority targets",
      "Force defensive cooldowns"
    ]
  };
}
