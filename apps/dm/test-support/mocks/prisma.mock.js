'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ItemQuality =
  exports.ItemType =
  exports.PlayerSlot =
  exports.Prisma =
  exports.PrismaClient =
    void 0;
class PrismaClient {
  $disconnect() {
    return Promise.resolve();
  }
}
exports.PrismaClient = PrismaClient;
exports.Prisma = {};
exports.PlayerSlot = {
  weapon: 'weapon',
  head: 'head',
  chest: 'chest',
  legs: 'legs',
  feet: 'feet',
};
exports.ItemType = {
  WEAPON: 'WEAPON',
  ARMOR: 'ARMOR',
};
exports.ItemQuality = {
  Trash: 'Trash',
  Poor: 'Poor',
  Common: 'Common',
  Uncommon: 'Uncommon',
  Fine: 'Fine',
  Superior: 'Superior',
  Rare: 'Rare',
  Epic: 'Epic',
  Legendary: 'Legendary',
  Mythic: 'Mythic',
  Artifact: 'Artifact',
  Ascended: 'Ascended',
  Transcendent: 'Transcendent',
  Primal: 'Primal',
  Divine: 'Divine',
};
//# sourceMappingURL=prisma.mock.js.map
