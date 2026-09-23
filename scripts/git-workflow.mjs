import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

export const repository = 'zhuangxuhong/shoe-test-platform';
export function git(args, cwd = process.cwd()) {
  const result = spawnSync('git', args, {cwd, encoding: 'utf8'});
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(result.stderr.trim() || 'Git command failed');
  return result.stdout.trim();
}
export function repositoryFromUrl(url) {
  const match = /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([^/]+\/[^/]+?)\/?$/.exec(url);
  return match ? match[1].replace(/\.git$/, '').toLowerCase() : null;
}
export function preflight(cwd = process.cwd()) {
  const root = git(['rev-parse', '--show-toplevel'], cwd);
  for (const name of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'sequencer']) {
    const location = git(['rev-parse', '--git-path', name], cwd);
    if (fs.existsSync(path.resolve(cwd, location))) throw Error('Finish the existing Git operation first: ' + name);
  }
  const remotes = git(['remote'], cwd).split(/\s+/).filter(Boolean);
  const upstream = remotes.find(remote => repositoryFromUrl(git(['config', '--get', 'remote.' + remote + '.url'], cwd)) === repository);
  if (!upstream) throw Error('No remote points to the expected upstream: ' + repository);
  const branch = git(['branch', '--show-current'], cwd);
  if (!branch) throw Error('Detached HEAD: preserve work and choose a branch first.');
  return {root, upstream, branch};
}
export function syncMain(cwd = process.cwd()) {
  const state = preflight(cwd);
  if (state.branch !== 'main') throw Error('Switch to main after preserving your feature work.');
  if (git(['status', '--porcelain'], cwd)) throw Error('Working tree has changes; preserve or commit them before synchronization.');
  git(['fetch', state.upstream, 'refs/heads/main'], cwd);
  const target = git(['rev-parse', 'FETCH_HEAD'], cwd);
  if (Number(git(['rev-list', '--count', target + '..HEAD'], cwd)) > 0) {
    throw Error('Local main has unpublished commits; preserve them on a feature branch and submit a PR.');
  }
  git(['merge', '--ff-only', target], cwd);
  return {branch: 'main', revision: git(['rev-parse', 'HEAD'], cwd), upstream: state.upstream};
}
