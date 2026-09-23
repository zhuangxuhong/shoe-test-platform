const {test, before} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
let git, preflight, syncMain, repositoryFromUrl;
before(async () => ({git, preflight, syncMain, repositoryFromUrl} = await import('../scripts/git-workflow.mjs')));

function fixture(t, fork = false) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shoe-git-test-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const upstream = path.join(dir, 'upstream');
  const local = path.join(dir, 'local');
  fs.mkdirSync(upstream);
  git(['init', '-b', 'main'], upstream);
  git(['config', 'user.name', 'Isolated Test'], upstream);
  git(['config', 'user.email', 'test@example.invalid'], upstream);
  fs.writeFileSync(path.join(upstream, 'example.txt'), 'initial');
  git(['add', 'example.txt'], upstream);
  git(['commit', '-m', 'initial'], upstream);
  git(['clone', upstream, local], dir);
  git(['config', 'user.name', 'Isolated Test'], local);
  git(['config', 'user.email', 'test@example.invalid'], local);
  const url = 'https://github.com/zhuangxuhong/shoe-test-platform.git';
  git(['remote', 'set-url', 'origin', fork ? 'https://github.com/test-contributor/shoe-test-platform.git' : url], local);
  if (fork) git(['remote', 'add', 'upstream', url], local);
  return {dir, upstream, local, url};
}
function withLocalTransport(f, action) {
  const previous = {...process.env};
  process.env.GIT_CONFIG_COUNT = '1';
  process.env.GIT_CONFIG_KEY_0 = 'url.' + f.upstream.replaceAll('\\', '/') + '.insteadOf';
  process.env.GIT_CONFIG_VALUE_0 = f.url;
  try { return action(); } finally {
    for (const key of ['GIT_CONFIG_COUNT', 'GIT_CONFIG_KEY_0', 'GIT_CONFIG_VALUE_0']) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
}
test('upstream identity rejects similar hosts and wrong repositories', () => {
  assert.equal(repositoryFromUrl('git@github.com:zhuangxuhong/shoe-test-platform.git'), 'zhuangxuhong/shoe-test-platform');
  assert.equal(repositoryFromUrl('https://github.com.evil.test/zhuangxuhong/shoe-test-platform'), null);
  assert.equal(repositoryFromUrl('https://github.com/other/project'), 'other/project');
});
test('sync refuses dirty work without changing tracked or untracked files', t => {
  const f = fixture(t);
  const head = git(['rev-parse', 'HEAD'], f.local);
  fs.writeFileSync(path.join(f.local, 'example.txt'), 'unfinished');
  fs.writeFileSync(path.join(f.local, 'notes.txt'), 'keep me');
  assert.throws(() => syncMain(f.local), /Working tree has changes/);
  assert.equal(git(['rev-parse', 'HEAD'], f.local), head);
  assert.equal(fs.readFileSync(path.join(f.local, 'example.txt'), 'utf8'), 'unfinished');
  assert.equal(fs.readFileSync(path.join(f.local, 'notes.txt'), 'utf8'), 'keep me');
});
test('preflight locates upstream for a Fork and rejects wrong origin', t => {
  const f = fixture(t, true);
  assert.equal(preflight(f.local).upstream, 'upstream');
  git(['remote', 'remove', 'upstream'], f.local);
  assert.throws(() => preflight(f.local), /No remote/);
});
test('sync refuses feature branch and unfinished Git operation', t => {
  const f = fixture(t);
  git(['switch', '-c', 'feature/keep'], f.local);
  assert.throws(() => syncMain(f.local), /Switch to main/);
  assert.equal(git(['branch', '--show-current'], f.local), 'feature/keep');
  fs.writeFileSync(path.join(f.local, '.git', 'MERGE_HEAD'), git(['rev-parse', 'HEAD'], f.local));
  assert.throws(() => preflight(f.local), /existing Git operation/);
});
test('sync fast-forwards precise upstream and retains ignored local settings', t => {
  const f = fixture(t, true);
  fs.writeFileSync(path.join(f.upstream, 'example.txt'), 'new upstream');
  git(['add', 'example.txt'], f.upstream);
  git(['commit', '-m', 'upstream update'], f.upstream);
  fs.writeFileSync(path.join(f.local, '.git', 'info', 'exclude'), '.env\n');
  fs.writeFileSync(path.join(f.local, '.env'), 'local-only');
  withLocalTransport(f, () => syncMain(f.local));
  assert.equal(git(['rev-parse', 'HEAD'], f.local), git(['rev-parse', 'HEAD'], f.upstream));
  assert.equal(fs.readFileSync(path.join(f.local, '.env'), 'utf8'), 'local-only');
});
test('sync rejects local-only commits instead of discarding or publishing them', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.local, 'example.txt'), 'unpublished');
  git(['add', 'example.txt'], f.local);
  git(['commit', '-m', 'local work'], f.local);
  const head = git(['rev-parse', 'HEAD'], f.local);
  withLocalTransport(f, () => assert.throws(() => syncMain(f.local), /unpublished commits/));
  assert.equal(git(['rev-parse', 'HEAD'], f.local), head);
});
