# Game Flow Documentation

## Player Lifecycle

### 1. Player Creation

```
Player registers → Generate random stats → Place at (0,0) → Ready to play
```

**Stats Generated:**

- Strength: 8-15 (affects damage)
- Health: 8-15 (affects max HP: 80 + health\*2)
- Agility: 8-15 (affects dodge chance)

### 2. Movement and Exploration

```
Player moves → Check new location → Get biome info → Encounter monsters/players
```

**Movement Commands:**

- `n/north`: Move up (y-1)
- `s/south`: Move down (y+1)
- `e/east`: Move right (x+1)
- `w/west`: Move left (x-1)

### 3. Combat

```
Player attacks → Roll damage → Apply modifiers → Check dodge → Deal damage → Award XP
```

**Combat Mechanics:**

- Base damage: 1d6 (1-6)
- Strength modifier: (strength - 10) / 2
- Dodge chance: (agility - 10) \* 5% per point above 10
- Final damage: max(1, base + modifier) if not dodged

### 4. Death and Respawn

```
HP reaches 0 → Player dies → Can respawn at (0,0) with full HP
```

## Monster Lifecycle

### 1. Spawning

```
Tick process → 5% chance → Near active players → Random monster type
```

**Monster Types:**

- Goblin: Fast, weak (agility 12, strength 6, health 6)
- Orc: Balanced (agility 8, strength 12, health 10)
- Wolf: Quick predator (agility 14, strength 10, health 8)
- Bear: Tank (agility 6, strength 16, health 14)
- Skeleton: Undead (agility 10, strength 8, health 6)

### 2. AI Behavior

```
Each tick → 40% chance to move → Random direction → 20% chance to attack nearby players
```

### 3. Death and Cleanup

```
HP reaches 0 → Mark as dead → Cleanup after 1 hour
```

## Game World Tick

The external tick service calls `/dm/tick` periodically. Each tick:

### 1. Time Advancement

```
Tick count++ → Every 4 ticks = 1 game hour → 24 hours = 1 game day
```

### 2. Monster Management

```
Spawn new monsters → Move existing monsters → Process monster attacks
```

### 3. World Updates

```
Update weather → Clean up dead monsters → Log events
```

### 4. Return Summary

```json
{
  "tick": 145,
  "gameHour": 12,
  "gameDay": 2,
  "monstersSpawned": 2,
  "monstersMoved": 8,
  "combatEvents": 3,
  "weatherUpdated": false
}
```

## Weather System

Simple pressure-based weather:

- **High pressure (1015+)**: Clear skies
- **Medium pressure (1005-1015)**: Cloudy
- **Low pressure (995-1005)**: Overcast
- **Very low pressure (<995)**: Rain or thunderstorms

## Combat Examples

### Player vs Monster

```
Hero (Strength 12) attacks Goblin (Agility 12)
1. Roll 1d6 = 4
2. Strength modifier = (12-10)/2 = 1
3. Total damage = 4 + 1 = 5
4. Dodge check = (12-10)*5% = 10%
5. Roll dodge = 45% (miss)
6. Goblin takes 5 damage
```

### Monster vs Player

```
Orc (Strength 12) attacks Hero (Agility 10)
1. Roll 1d6 = 2
2. Strength modifier = (12-10)/2 = 1
3. Total damage = 2 + 1 = 3
4. Dodge check = (10-10)*5% = 0%
5. No dodge possible
6. Hero takes 3 damage
```

## Experience and Progression

Currently XP is awarded for defeating monsters:

- Goblin: 25 XP
- Skeleton: 30 XP
- Wolf: 40 XP
- Orc: 50 XP
- Bear: 75 XP

_Note: Level progression and stat increases are not yet implemented but the foundation is there._

## Integration Points

### With World Service

- Get tile information: biome, description, terrain data
- Validate movement targets
- Provide environmental context

### With Tick Service

- Receive periodic tick calls
- Coordinate world state updates
- Synchronize time across services

### With Database

- Store player states and stats
- Track monster positions and health
- Log combat events
- Maintain game world state
