# constants

This library was generated with [Nx](https://nx.dev).

## Building

Run `yarn build constants` to build the library.

## Loot system (ranked base items)

This library includes new utility functions and data to support ranked base
items and quality modifiers for loot drops.

- `ItemTemplateSeed.rank`: Item templates now optionally include a `rank` 1-10.
- `MAX_PLAYER_SCALE`: The player leveling scale (defaults to 20 for this
  initial implementation).
- `expectedRankForLevel(level)`: Map player level to an expected template rank.
- `pickTemplatesForLevel(level, count)`: Pick `count` templates that suit the
  given level — useful for shop rotations and loot previews.

These functions are exported for use by `dm` and `slack` services.
