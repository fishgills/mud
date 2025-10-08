import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { PartyFactory } from '../factories/party-factory';
import { EventBus } from '../events/event-bus';

describe('PartyFactory', () => {
  let emitSpy: jest.SpiedFunction<typeof EventBus.emit>;

  beforeEach(() => {
    emitSpy = jest.spyOn(EventBus, 'emit').mockResolvedValue();
    PartyFactory.clear();
  });

  afterEach(() => {
    PartyFactory.clear();
    jest.restoreAllMocks();
  });

  it('creates parties and emits events', async () => {
    const party = await PartyFactory.create({
      name: 'Heroes',
      leaderId: 1,
      leaderName: 'Alice',
      maxSize: 4,
    });

    expect(party.id).toBe(1);
    expect(party.leaderId).toBe(1);
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'party:create', partyId: 1 }),
    );

    expect(PartyFactory.load(party.id)).toBe(party);
    expect(PartyFactory.findByPlayerId(1)).toBe(party);
    expect(PartyFactory.getAll()).toEqual([party]);
  });

  it('saves updates and deletes parties', async () => {
    const party = await PartyFactory.create({
      name: 'Heroes',
      leaderId: 1,
      leaderName: 'Alice',
    });

    party.addMember(2, 'Bob');
    PartyFactory.save(party);

    expect(PartyFactory.findByPlayerId(2)).toBe(party);

    emitSpy.mockClear();
    await expect(PartyFactory.delete(party.id)).resolves.toBe(true);
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'party:disband',
        partyId: party.id,
      }),
    );
    expect(PartyFactory.load(party.id)).toBeNull();
  });

  it('returns false when deleting missing parties', async () => {
    await expect(PartyFactory.delete(999)).resolves.toBe(false);
    expect(emitSpy).not.toHaveBeenCalled();
  });
});
