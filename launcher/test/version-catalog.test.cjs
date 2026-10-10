const test = require('node:test');
const assert = require('node:assert/strict');
const { isMinecraftVersionManifest, selectMinecraftVersions, getSupportMatrix } = require('../dist/main/version-catalog.js');

const version = (id, type, releaseTime) => ({
  id,
  type,
  url: `https://example.test/${id}`,
  time: releaseTime,
  releaseTime,
});

const manifest = {
  latest: { release: '1.21.4', snapshot: '25w01a' },
  versions: [
    version('1.19.4', 'release', '2023-03-14T00:00:00Z'),
    version('1.20', 'release', '2023-06-07T00:00:00Z'),
    version('1.21.4', 'release', '2024-12-03T00:00:00Z'),
    version('24w14a', 'snapshot', '2024-04-03T00:00:00Z'),
    version('25w01a', 'snapshot', '2025-01-01T00:00:00Z'),
    version('23w20a', 'snapshot', '2023-05-17T00:00:00Z'),
    version('1.20-rc1', 'release', '2023-06-01T00:00:00Z'),
  ],
};

test('validiert die Struktur des offiziellen Manifests', () => {
  assert.equal(isMinecraftVersionManifest(manifest), true);
  assert.equal(isMinecraftVersionManifest({ latest: {}, versions: [null] }), false);
});

test('filtert alte Releases und Snapshots vor dem 1.20-Stichtag heraus', () => {
  assert.deepEqual(selectMinecraftVersions(manifest).map(({ id }) => id), ['1.20', '1.21.4', '24w14a', '25w01a']);
});

test('filtert nach Typ und case-insensitiver Versionssuche', () => {
  assert.deepEqual(selectMinecraftVersions(manifest, 'snapshot', '25W').map(({ id }) => id), ['25w01a']);
  assert.deepEqual(selectMinecraftVersions(manifest, 'release').map(({ id }) => id), ['1.20', '1.21.4']);
});

test('liefert die tatsächliche Support-Matrix für Versionen ab 1.20.0', () => {
  const matrix = getSupportMatrix(manifest);
  assert.equal(matrix.supportedMinVersion, '1.20.0');
  assert.equal(matrix.verifiedBuildTarget, '1.20.1');
  assert.deepEqual(matrix.supportedReleaseVersions, ['1.20', '1.21.4']);
  assert.deepEqual(matrix.supportedSnapshotVersions, ['24w14a', '25w01a']);
  assert.equal(matrix.supportedCount, 4);
});

test('erkennt Java- und Installationsanforderungen für Instanzen korrekt', () => {
  const { evaluateJavaRequirement, createInstanceProfile, createInstallPlan, InstanceManager, checkLoaderCompatibility } = require('../dist/main/instance-manager.js');

  assert.deepEqual(evaluateJavaRequirement('1.20.1'), { requiredJavaMajor: 17, recommendedMemoryMb: 2048, compatible: true });
  assert.deepEqual(evaluateJavaRequirement('1.21.4'), { requiredJavaMajor: 21, recommendedMemoryMb: 4096, compatible: true });

  const loaderCompatibility = checkLoaderCompatibility('1.21.4', 'fabric');
  assert.equal(loaderCompatibility.supported, true);
  assert.equal(loaderCompatibility.requiredJavaMajor, 21);

  const instance = createInstanceProfile({
    id: 'inst-1',
    name: 'Test-Instanz',
    versionId: '1.21.4',
    loader: 'fabric',
    loaderVersion: '0.16.14',
    memoryMb: 4096,
  });

  assert.equal(instance.versionId, '1.21.4');
  assert.equal(instance.loader, 'fabric');
  assert.equal(instance.javaMajor, 21);

  const plan = createInstallPlan({
    versionId: '1.21.4',
    loader: 'fabric',
    loaderVersion: '0.16.14',
    memoryMb: 4096,
  });

  assert.equal(plan.compatible, true);
  assert.deepEqual(plan.requiredSteps, ['version-check', 'loader-check', 'java-check', 'instance-create']);
  assert.equal(plan.blockerReason, undefined);

  const manager = new InstanceManager();
  const created = manager.createInstance({
    id: 'inst-runner',
    name: 'Runner',
    versionId: '1.20.1',
    loader: 'fabric',
    loaderVersion: '0.16.14',
    memoryMb: 2048,
  });

  assert.equal(created.name, 'Runner');
  assert.equal(manager.listInstances().length, 1);
  const duplicated = manager.duplicateInstance('inst-runner', 'inst-runner-copy');
  assert.equal(duplicated.id, 'inst-runner-copy');
  assert.equal(manager.renameInstance('inst-runner', 'Runner 2').name, 'Runner 2');
  assert.equal(manager.deleteInstance('inst-runner-copy'), true);
});