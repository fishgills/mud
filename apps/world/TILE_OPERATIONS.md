# Tile GraphQL Operations Summary

## Added Features

### 1. TileResolver (`/src/world/tile.resolver.ts`)

- **Query**: `getTile(x: Int!, y: Int!)` - Returns `TileWithNearbyBiomes`
- **Mutation**: `updateTileDescription(x: Int!, y: Int!, description: String!)` - Returns `TileUpdateResult`

### 2. TileUpdateResult Model (`/src/world/models/tile-update-result.model.ts`)

- `success: Boolean!` - Indicates if the operation was successful
- `message: String!` - Descriptive message about the operation result

### 3. Module Registration

- Added `TileResolver` to `WorldModule` providers

## GraphQL API Equivalents to REST

| REST Endpoint                 | GraphQL Operation                                                         | Description                                 |
| ----------------------------- | ------------------------------------------------------------------------- | ------------------------------------------- |
| `GET /tile/:x/:y`             | `query { getTile(x: Int, y: Int) }`                                       | Get tile with nearby biomes and settlements |
| `PUT /tile/:x/:y/description` | `mutation { updateTileDescription(x: Int, y: Int, description: String) }` | Update tile description                     |

## Example Usage

```graphql
# Query a tile
query {
  getTile(x: 25, y: 50) {
    x
    y
    biomeName
    description
    nearbyBiomes {
      biomeName
      distance
    }
  }
}

# Update tile description
mutation {
  updateTileDescription(x: 25, y: 50, description: "Ancient ruins") {
    success
    message
  }
}
```

## Type Safety

- All operations use proper TypeScript types
- GraphQL schema auto-generated from TypeScript decorators
- Consistent error handling with descriptive messages
