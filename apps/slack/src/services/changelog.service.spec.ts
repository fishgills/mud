import { tmpdir } from 'node:os';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getRecentChangelogEntries } from './changelog.service';

describe('getRecentChangelogEntries', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'changelog-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('parses entries from changelog file', async () => {
    const changelogPath = path.join(tempDir, 'CHANGELOG.md');
    await writeFile(
      changelogPath,
      '# 0.0.1\n\n### Features\n\n* add changelog section ([abcdef1](https://example.com))\n',
      'utf8',
    );

    const entries = await getRecentChangelogEntries(5, {
      changelogPath,
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      description: 'add changelog section',
      hash: 'abcdef1',
      type: 'feat',
    });
  });

  it('returns empty array when changelog file is missing', async () => {
    const entries = await getRecentChangelogEntries(5, {
      changelogPath: path.join(tempDir, 'missing.md'),
    });
    expect(entries).toEqual([]);
  });
});
