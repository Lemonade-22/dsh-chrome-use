import test from 'node:test';
import assert from 'node:assert/strict';
import clean from '../scripts/clean-releases.cjs';

function fixture(latestId = null) {
  const deleted = [], tags = [], reports = [];
  const releases = [
    { id: 1, name: 'dsh-chrome-use-v0.10.1-2026.11.12-10.00.00', tag_name: 'build-1' },
    { id: 2, name: 'dsh-chrome-use-v0.10.1-2026.11.13-10.00.00', tag_name: 'build-2' },
    { id: 3, name: 'dsh-chrome-use-v0.10.1-2026.11.14-10.00.00', tag_name: 'build-3' },
    { id: 4, name: 'dsh-chrome-use-v0.10.0-2026.11.10-10.00.00', tag_name: 'build-4' },
    { id: 5, name: 'dsh-chrome-use 0.10.1', tag_name: 'release-v0.10.1' },
  ];
  const summary = { addHeading() { return this; }, addTable() { return this; }, addRaw() { return this; }, async write() {} };
  const github = {
    paginate: async () => releases,
    rest: {
      repos: {
        listReleases() {},
        async getLatestRelease() { if (latestId === null) throw { status: 404 }; return { data: { id: latestId } }; },
        async deleteRelease({ release_id }) { deleted.push(release_id); },
      },
      git: { async deleteRef({ ref }) { tags.push(ref); } },
    },
  };
  const core = { info: text => reports.push(text), warning: text => reports.push(text), error: text => reports.push(text), setFailed: text => { throw Error(text); }, summary };
  return { args: { github, context: { repo: { owner: 'owner', repo: 'repo' } }, core }, deleted, tags, reports };
}

test('cleanup keeps two builds per version and ignores official releases', async () => {
  const f = fixture();
  const result = await clean({ ...f.args, keep: '2', dryRun: 'false', deleteTags: 'true' });
  assert.deepEqual(f.deleted, [1]);
  assert.deepEqual(f.tags, ['tags/build-1']);
  assert.equal(result.kept, 3);
});

test('cleanup preview does not delete releases or tags', async () => {
  const f = fixture();
  const result = await clean({ ...f.args, keep: '1', dryRun: 'true', deleteTags: 'true' });
  assert.equal(result.wouldDelete, 2);
  assert.deepEqual(f.deleted, []);
  assert.deepEqual(f.tags, []);
});

test('cleanup protects Latest even when older than the retained builds', async () => {
  const f = fixture(1);
  await clean({ ...f.args, keep: '2', dryRun: 'false', deleteTags: 'true' });
  assert.deepEqual(f.deleted, []);
});

test('cleanup always keeps at least one build and honors deleteTags=false', async () => {
  const f = fixture();
  await clean({ ...f.args, keep: '-2', dryRun: 'false', deleteTags: 'false' });
  assert.deepEqual([...f.deleted].sort(), [1, 2]);
  assert.deepEqual(f.tags, []);
});
