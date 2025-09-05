# Combat System Debug Summary

## Overview

Comprehensive debug logging has been added throughout the D&D 3rd edition combat system to provide full visibility into combat mechanics, dice rolls, and combat flow.

## Debug Features Added

### 1. Dice Roll Logging

- **rollD20()**: Logs individual d20 roll results
- **rollDice()**: Logs dice roll parameters (count, sides) and individual results
- **Format**: `🎲 Rolling 1d20: result=15` or `🎲 Rolling 2d6: [3, 5] = 8`

### 2. Combat Calculations

- **getModifier()**: Shows ability score to modifier conversion
- **calculateAC()**: Shows agility to AC calculation
- **rollInitiative()**: Shows initiative roll + agility modifier
- **calculateDamage()**: Shows strength-based damage calculation
- **calculateXpGain()**: Shows XP formula calculation
- **Format**: `Agility 14 -> AC 12` or `XP calculation: loser level 3, winner level 2 = 30 XP`

### 3. Combatant Creation

- **playerToCombatant()**: Logs all player stats (name, level, HP, str, agi, x, y)
- **monsterToCombatant()**: Logs all monster stats
- **Format**: `🧙‍♂️ Player combatant: Alice (Level 5, 45/50 HP, STR:16, AGI:14) at (10,5)`

### 4. Combat Flow Logging

- **Combat Initialization**: Combat ID, participant stats, location
- **Initiative Results**: Shows rolls and determines first attacker
- **Round-by-Round**: Each attack with detailed resolution
- **Combat Completion**: Final results and winner/loser status

### 5. Attack Resolution

- **Per-Round Logging**:
  - `⚔️ Round 1: Alice attacks Goblin`
  - `Attack roll: 15 + 3 = 18 vs AC 12 -> HIT`
  - `💥 Alice hits Goblin for 6 damage! HP: 20 -> 14`
  - `🛡️ Alice misses Goblin` (on miss)
  - `💀 Goblin is defeated!` (on death)

### 6. Combat Results Application

- **Database Updates**: HP changes, XP awards, respawning
- **XP Awards**: Shows XP calculation and player progression
- **Database Logging**: Combat history recording
- **Format**: `📈 Alice gained 30 XP! Total XP: 1200 -> 1230`

### 7. Public Method Entry Points

- **playerAttackMonster()**: Logs initiation, pre-combat checks, completion
- **monsterAttackPlayer()**: Same comprehensive logging
- **playerAttackPlayer()**: PvP combat with location verification
- **Pre-combat Validation**: Logs why combat might be blocked (dead players, wrong location)

## Log Levels Used

### Logger.log() - Important Events

- Combat initiation and completion
- Combat winners and final results
- XP gains and player progression
- Player respawning
- Combat deaths

### Logger.debug() - Detailed Information

- Dice roll results and calculations
- Combatant stats and conversions
- Round-by-round attack details
- Database operations
- Turn switching

### Logger.warn() - Blocked Actions

- Combat blocked due to dead players
- Location mismatches
- Invalid combat conditions

## Sample Debug Output

```
🗡️ Player attack initiated: U123456 attacking monster 42
🧙‍♂️ Player combatant: Alice (Level 5, 45/50 HP, STR:16, AGI:14) at (10,5)
👹 Monster combatant: Goblin (Level 3, 20/20 HP, STR:12, AGI:10) at (10,5)
✅ Pre-combat checks passed, starting combat...
⚡ Combat started: alice-vs-goblin-1703123456789 at (10,5)
🎲 Rolling 1d20: result=15
Initiative: Alice = 15 + 2 = 17
🎲 Rolling 1d20: result=8
Initiative: Goblin = 8 + 0 = 8
⚡ Initiative Results: Alice=17, Goblin=8 | Alice goes first!
⚔️ Round 1: Alice attacks Goblin
🎲 Rolling 1d20: result=12
Attack roll: 12 + 3 = 15 vs AC 10 -> HIT
🎲 Rolling 1d6: result=4
💥 Alice hits Goblin for 7 damage! HP: 20 -> 13
Turn switch: Next attacker is Goblin
⚔️ Round 2: Goblin attacks Alice
🎲 Rolling 1d20: result=6
Attack roll: 6 + 1 = 7 vs AC 12 -> MISS
🛡️ Goblin misses Alice
🏁 Combat completed after 2 full rounds
🏆 Winner: Alice (45 HP remaining)
💀 Loser: Goblin (13 HP remaining)
📈 XP calculation: winner level 5, loser level 3 = 12 XP
💾 Combat log created with 4 individual attacks and 7 total damage
🔄 Applying combat results for combat alice-vs-goblin-1703123456789
📈 Alice gained 12 XP! Total XP: 1200 -> 1212
💾 Combat results applied and logged to database
✅ Player vs Monster combat completed: Alice defeats Goblin after 2 rounds of combat!
```

## Benefits

1. **Debugging**: Easy to identify issues in combat calculations
2. **Balancing**: Clear visibility into damage, hit rates, and XP rewards
3. **AI Integration**: Structured logs perfect for AI narration generation
4. **Player Experience**: Rich combat details for immersive gameplay
5. **Development**: Comprehensive audit trail for combat mechanics

## Usage

Set NestJS log level to `debug` to see all combat details:

- Production: `log` level for important events only
- Development: `debug` level for full combat visibility
- Testing: `debug` level for combat system validation
