#!/usr/bin/env python3
"""
TrinityCore 11.2 Schema Audit Tool
Scans entire project for legacy 3.3.5a schema references
"""

import os
import re
from pathlib import Path
from collections import defaultdict

# TrinityCore 11.2 Schema Reference
TC_11_2_SCHEMA = {
    'quest_template': {
        'correct': ['ID', 'LogTitle', 'LogDescription', 'QuestDescription', 'QuestCompletionLog',
                   'RewardMoney', 'RewardBonusMoney', 'RewardDisplaySpell', 'RewardSpell',
                   'RewardItem1', 'RewardAmount1', 'RewardItem2', 'RewardAmount2',
                   'RewardItem3', 'RewardAmount3', 'RewardItem4', 'RewardAmount4',
                   'RewardFactionID1', 'RewardFactionValue1', 'RewardFactionOverride1',
                   'RewardFactionID2', 'RewardFactionValue2', 'RewardFactionID3',
                   'RewardFactionValue3', 'RewardFactionID4', 'RewardFactionValue4',
                   'RewardFactionID5', 'RewardFactionValue5', 'RewardXPDifficulty',
                   'MinLevel', 'MaxLevel', 'QuestInfoID', 'QuestSortID', 'QuestType',
                   'SuggestedPlayers', 'LimitTime', 'Flags', 'FlagsEx', 'FlagsEx2',
                   'RewardTitle', 'RewardArenaPoints', 'RewardSkillLineID', 'RewardNumSkillUps'],
        'legacy': ['QuestTitle', 'QuestLevel', 'RequiredNpcOrGo1', 'RequiredNpcOrGo2',
                  'RequiredNpcOrGo3', 'RequiredNpcOrGo4', 'RequiredNpcOrGoCount1',
                  'RequiredItemId1', 'RequiredItemId2', 'RequiredItemCount1',
                  'OfferRewardText', 'RequestItemsText', 'EndText', 'CompletedText',
                  'ObjectiveText1', 'ObjectiveText2', 'ObjectiveText3', 'ObjectiveText4',
                  'DetailsEmote1', 'DetailsEmote2', 'IncompleteEmote', 'CompleteEmote',
                  'StartScript', 'CompleteScript']
    },
    'quest_template_addon': {
        'correct': ['ID', 'MaxLevel', 'AllowableClasses', 'SourceSpellID', 'PrevQuestID',
                   'NextQuestID', 'ExclusiveGroup', 'BreadcrumbForQuestId', 'RewardMailTemplateID',
                   'RequiredSkillID', 'RequiredSkillPoints', 'RequiredMinRepFaction',
                   'RequiredMaxRepFaction', 'RequiredMinRepValue', 'RequiredMaxRepValue',
                   'ProvidedItemCount', 'SpecialFlags', 'ScriptName'],
        'legacy': ['RequiredMaxRepValue']  # None known for addon
    },
    'quest_objectives': {
        'correct': ['ID', 'QuestID', 'Type', 'Order', 'StorageIndex', 'ObjectID', 'Amount',
                   'Flags', 'Flags2', 'ProgressBarWeight', 'Description', 'VerifiedBuild'],
        'legacy': []  # New table in 11.2, no legacy
    },
    'quest_reward_choice_items': {
        'correct': ['ItemID', 'Quantity', 'QuestID'],
        'legacy': ['ItemCount']  # Old name for Quantity
    },
    'creature_template': {
        'correct': ['entry', 'difficulty_entry_1', 'difficulty_entry_2', 'difficulty_entry_3',
                   'KillCredit1', 'KillCredit2', 'name', 'subname', 'IconName', 'gossip_menu_id',
                   'minlevel', 'maxlevel', 'exp', 'faction', 'npcflag', 'speed_walk', 'speed_run',
                   'BaseAttackTime', 'RangeAttackTime', 'BaseVariance', 'RangeVariance',
                   'unit_class', 'unit_flags', 'unit_flags2', 'unit_flags3', 'dynamicflags',
                   'family', 'trainer_class', 'type', 'type_flags', 'lootid', 'pickpocketloot',
                   'skinloot', 'PetSpellDataId', 'VehicleId', 'mingold', 'maxgold', 'AIName',
                   'MovementType', 'HoverHeight', 'HealthModifier', 'ManaModifier', 'ArmorModifier',
                   'DamageModifier', 'ExperienceModifier', 'RacialLeader', 'movementId',
                   'CreatureDifficultyID', 'WidgetSetID', 'WidgetSetUnitConditionID',
                   'RegenHealth', 'mechanic_immune_mask', 'spell_school_immune_mask', 'flags_extra',
                   'ScriptName', 'VerifiedBuild'],
        'legacy': ['modelid1', 'modelid2', 'modelid3', 'modelid4']  # Removed in 11.2
    },
    'creature': {
        'correct': ['guid', 'id', 'map', 'zoneId', 'areaId', 'spawnMask', 'phaseMask', 'equipment_id',
                   'position_x', 'position_y', 'position_z', 'orientation', 'spawntimesecs',
                   'wander_distance', 'currentwaypoint', 'curhealth', 'curmana', 'MovementType',
                   'npcflag', 'unit_flags', 'dynamicflags', 'ScriptName', 'VerifiedBuild'],
        'legacy': ['modelid', 'equipment_id']
    },
    'item_template': {
        'correct': ['entry', 'class', 'subclass', 'SoundOverrideSubclass', 'name', 'displayid',
                   'Quality', 'Flags', 'FlagsExtra', 'BuyCount', 'BuyPrice', 'SellPrice',
                   'InventoryType', 'AllowableClass', 'AllowableRace', 'ItemLevel', 'RequiredLevel',
                   'RequiredSkill', 'RequiredSkillRank', 'requiredspell', 'requiredhonorrank',
                   'RequiredCityRank', 'RequiredReputationFaction', 'RequiredReputationRank',
                   'maxcount', 'stackable', 'ContainerSlots', 'StatsCount', 'stat_type1',
                   'stat_value1', 'stat_type2', 'stat_value2', 'ScalingStatDistribution',
                   'ScalingStatValue', 'dmg_min1', 'dmg_max1', 'dmg_type1', 'armor', 'holy_res',
                   'fire_res', 'nature_res', 'frost_res', 'shadow_res', 'arcane_res', 'delay',
                   'ammo_type', 'RangedModRange', 'spellid_1', 'spelltrigger_1', 'spellcharges_1',
                   'spellppmRate_1', 'spellcooldown_1', 'spellcategory_1', 'spellcategorycooldown_1',
                   'bonding', 'description', 'PageText', 'LanguageID', 'PageMaterial', 'startquest',
                   'lockid', 'Material', 'sheath', 'RandomProperty', 'RandomSuffix', 'block',
                   'itemset', 'MaxDurability', 'area', 'Map', 'BagFamily', 'TotemCategory',
                   'socketColor_1', 'socketContent_1', 'socketBonus', 'GemProperties',
                   'RequiredDisenchantSkill', 'ArmorDamageModifier', 'duration', 'ItemLimitCategory',
                   'HolidayId', 'ScriptName', 'DisenchantID', 'FoodType', 'minMoneyLoot',
                   'maxMoneyLoot', 'flagsCustom', 'VerifiedBuild'],
        'legacy': []
    }
}

# Legacy patterns to detect
LEGACY_PATTERNS = [
    r'QuestTitle',
    r'QuestLevel',
    r'RequiredNpcOrGo[1-4]',
    r'RequiredNpcOrGoCount[1-4]',
    r'RequiredItemId[1-4]',
    r'RequiredItemCount[1-4]',
    r'ObjectiveText[1-4]',
    r'OfferRewardText',
    r'RequestItemsText',
    r'quest_template_reward_choice_items',  # Wrong table name
    r'modelid[1-4]',
]

def scan_file(filepath):
    """Scan a TypeScript file for legacy schema references"""
    issues = []

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.split('\n')

        for i, line in enumerate(lines, 1):
            for pattern in LEGACY_PATTERNS:
                if re.search(pattern, line, re.IGNORECASE):
                    issues.append({
                        'file': str(filepath),
                        'line': i,
                        'content': line.strip(),
                        'pattern': pattern,
                        'severity': 'CRITICAL'
                    })
    except Exception as e:
        print(f"Error scanning {filepath}: {e}")

    return issues

def main():
    project_root = Path(r'C:\TrinityBots\trinitycore-mcp\src')

    print("=" * 80)
    print("TrinityCore 11.2 Schema Audit")
    print("=" * 80)
    print(f"Scanning: {project_root}")
    print()

    all_issues = []
    files_scanned = 0

    # Scan all TypeScript files
    for ts_file in project_root.rglob('*.ts'):
        if 'node_modules' in str(ts_file) or '.next' in str(ts_file):
            continue

        files_scanned += 1
        issues = scan_file(ts_file)
        all_issues.extend(issues)

    print(f"Files scanned: {files_scanned}")
    print(f"Issues found: {len(all_issues)}")
    print()

    if all_issues:
        print("=" * 80)
        print("LEGACY SCHEMA REFERENCES FOUND")
        print("=" * 80)
        print()

        # Group by file
        by_file = defaultdict(list)
        for issue in all_issues:
            by_file[issue['file']].append(issue)

        for filepath, file_issues in sorted(by_file.items()):
            print(f"\n[FILE] {filepath}")
            print("-" * 80)
            for issue in file_issues:
                print(f"  Line {issue['line']:4d}: {issue['pattern']}")
                print(f"           -> {issue['content'][:100]}")

        # Summary by pattern
        print("\n" + "=" * 80)
        print("SUMMARY BY PATTERN")
        print("=" * 80)
        by_pattern = defaultdict(int)
        for issue in all_issues:
            by_pattern[issue['pattern']] += 1

        for pattern, count in sorted(by_pattern.items(), key=lambda x: -x[1]):
            print(f"  {pattern:40s}: {count:3d} occurrences")
    else:
        print("✅ No legacy schema references found!")
        print("   All database queries appear to use TrinityCore 11.2 schema.")

    print()
    print("=" * 80)
    print("Audit Complete")
    print("=" * 80)

if __name__ == '__main__':
    main()
