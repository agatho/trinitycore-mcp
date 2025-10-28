/**
 * Profession MCP Tool
 *
 * Profession system data: recipes, skill requirements, material costs,
 * crafting profitability, and skill-up optimization for bot decisions.
 *
 * @module profession
 */

import { queryWorld } from "../database/connection";

export interface ProfessionRecipe {
  spellId: number;
  name: string;
  skillId: number;
  skillName: string;
  requiredSkillRank: number;
  learnedAt: number; // Skill level when recipe becomes available
  categoryId: number;
  difficulty: {
    orange: number; // Guaranteed skill-up
    yellow: number; // High chance skill-up
    green: number; // Low chance skill-up
    gray: number; // No skill-up
  };
  reagents: Array<{
    itemId: number;
    itemName?: string;
    count: number;
  }>;
  creates: {
    itemId: number;
    itemName?: string;
    minCount: number;
    maxCount: number;
  };
  profitability?: {
    materialCost: number;
    productValue: number;
    profit: number;
    profitMargin: number; // percentage
  };
}

export interface ProfessionInfo {
  skillId: number;
  name: string;
  maxSkill: number;
  type: "primary" | "secondary";
  description: string;
}

export interface SkillUpPlan {
  skillId: number;
  currentSkill: number;
  targetSkill: number;
  recipes: Array<{
    spellId: number;
    name: string;
    craftCount: number;
    skillGain: number;
    totalMaterialCost: number;
    skillRange: string; // e.g., "1-50"
  }>;
  totalCost: number;
  estimatedTime: number; // minutes
}

export async function getProfessionRecipes(skillId: number, minSkill?: number, maxSkill?: number): Promise<ProfessionRecipe[]> {
  let query = `
    SELECT
      ts.SpellId as spellId, ts.ReqSkillRank as requiredSkillRank,
      ts.TrivialSkillHigh as gray, ts.TrivialSkillLow as green,
      ts.GraySkill as difficulty_gray, ts.GreenSkill as difficulty_green,
      ts.YellowSkill as difficulty_yellow, ts.OrangeSkill as difficulty_orange
    FROM trainer_spell ts
    WHERE ts.ReqSkillLine = ?
  `;

  const params: any[] = [skillId];

  if (minSkill !== undefined) {
    query += " AND ts.ReqSkillRank >= ?";
    params.push(minSkill);
  }

  if (maxSkill !== undefined) {
    query += " AND ts.ReqSkillRank <= ?";
    params.push(maxSkill);
  }

  query += " ORDER BY ts.ReqSkillRank LIMIT 200";

  const recipes = await queryWorld(query, params);

  return recipes.map((r: any) => ({
    spellId: r.spellId,
    name: `Recipe ${r.spellId}`,
    skillId,
    skillName: getSkillName(skillId),
    requiredSkillRank: r.requiredSkillRank,
    learnedAt: r.requiredSkillRank,
    categoryId: 0,
    difficulty: {
      orange: r.difficulty_orange || r.requiredSkillRank,
      yellow: r.difficulty_yellow || r.requiredSkillRank + 10,
      green: r.difficulty_green || r.requiredSkillRank + 20,
      gray: r.difficulty_gray || r.requiredSkillRank + 30
    },
    reagents: [],
    creates: {
      itemId: 0,
      minCount: 1,
      maxCount: 1
    }
  }));
}

export async function getRecipeReagents(spellId: number): Promise<Array<{ itemId: number; count: number }>> {
  // Note: Reagent data is typically in spell_template
  const query = `
    SELECT
      Reagent1 as reagent1, Reagent2 as reagent2, Reagent3 as reagent3,
      ReagentCount1 as count1, ReagentCount2 as count2, ReagentCount3 as count3
    FROM spell_template
    WHERE ID = ?
  `;

  const results = await queryWorld(query, [spellId]);

  if (!results || results.length === 0) {
    return [];
  }

  const spell = results[0];
  const reagents: Array<{ itemId: number; count: number }> = [];

  for (let i = 1; i <= 3; i++) {
    const itemId = spell[`reagent${i}`];
    const count = spell[`count${i}`];

    if (itemId && itemId > 0 && count && count > 0) {
      reagents.push({ itemId, count });
    }
  }

  return reagents;
}

export async function calculateSkillUpPlan(
  skillId: number,
  currentSkill: number,
  targetSkill: number
): Promise<SkillUpPlan> {
  const recipes = await getProfessionRecipes(skillId, currentSkill, targetSkill);

  const plan: SkillUpPlan = {
    skillId,
    currentSkill,
    targetSkill,
    recipes: [],
    totalCost: 0,
    estimatedTime: 0
  };

  let skill = currentSkill;

  for (const recipe of recipes) {
    if (skill >= targetSkill) break;

    // Calculate how many times to craft this recipe
    const skillGainPer = skill < recipe.difficulty.yellow ? 1 : 0.5;
    const craftsNeeded = Math.ceil((recipe.difficulty.green - skill) / skillGainPer);

    if (craftsNeeded > 0 && skill < recipe.difficulty.green) {
      const totalGain = craftsNeeded * skillGainPer;

      plan.recipes.push({
        spellId: recipe.spellId,
        name: recipe.name,
        craftCount: craftsNeeded,
        skillGain: totalGain,
        totalMaterialCost: 0, // Would need item price data
        skillRange: `${skill}-${Math.min(skill + totalGain, targetSkill)}`
      });

      skill += totalGain;
      plan.estimatedTime += craftsNeeded * 0.5; // 30 sec per craft
    }
  }

  return plan;
}

export async function findProfitableRecipes(skillId: number, currentSkill: number): Promise<ProfessionRecipe[]> {
  const recipes = await getProfessionRecipes(skillId, Math.max(1, currentSkill - 50), currentSkill + 50);

  // Filter to recipes that can still give skill-ups
  return recipes.filter(r => currentSkill < r.difficulty.gray);
}

function getSkillName(skillId: number): string {
  const skills: { [key: number]: string } = {
    164: "Blacksmithing",
    165: "Leatherworking",
    171: "Alchemy",
    182: "Herbalism",
    185: "Cooking",
    186: "Mining",
    197: "Tailoring",
    202: "Engineering",
    333: "Enchanting",
    393: "Skinning",
    755: "Jewelcrafting",
    773: "Inscription"
  };

  return skills[skillId] || `Skill ${skillId}`;
}
