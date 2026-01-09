/* global exports */
'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.EventBus = exports.MonsterFactory = exports.PlayerFactory = void 0;
const players = new Map();
let autoIncrement = 1;
const normalizeClientId = (clientId, clientType) => {
  if (!clientId) return '';
  const prefix = clientType ? `${clientType}:` : '';
  if (prefix && clientId.startsWith(prefix)) {
    return clientId.slice(prefix.length);
  }
  if (clientId.startsWith('slack:')) {
    return clientId.slice('slack:'.length);
  }
  return clientId;
};
exports.PlayerFactory = {
  async create(input) {
    const canonicalClientId = normalizeClientId(
      input.clientId,
      input.clientType,
    );
    const entity = {
      ...input,
      clientId: canonicalClientId,
      id: input.id ?? autoIncrement++,
    };
    players.set(canonicalClientId, entity);
    players.set(input.clientId, entity);
    return entity;
  },
  async load(clientId, clientType) {
    const canonical = normalizeClientId(clientId, clientType);
    return players.get(canonical) ?? players.get(clientId) ?? null;
  },
  async clear() {
    players.clear();
    autoIncrement = 1;
  },
};
const noop = async () => undefined;
exports.MonsterFactory = {
  load: noop,
  save: noop,
  delete: noop,
};
exports.EventBus = {
  on: () => () => undefined,
  emit: noop,
  clear: () => undefined,
};
//# sourceMappingURL=mud-engine.stub.js.map
