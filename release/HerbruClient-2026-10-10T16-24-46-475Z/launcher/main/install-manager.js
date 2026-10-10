"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSafePath = validateSafePath;
exports.sanitizeEntryPath = sanitizeEntryPath;
exports.fetchJson = fetchJson;
exports.fetchAndVerifyFile = fetchAndVerifyFile;
exports.buildVersionAssetList = buildVersionAssetList;
exports.resolveVersionMetadata = resolveVersionMetadata;
exports.installVersion = installVersion;
exports.ensureVersionMetadataFile = ensureVersionMetadataFile;
exports.validateManifestIntegrity = validateManifestIntegrity;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const instance_manager_1 = require("./instance-manager");
function validateSafePath(baseDir, targetPath) {
    const normalizedBase = (0, node_path_1.resolve)(baseDir);
    const normalizedTarget = (0, node_path_1.resolve)(normalizedBase, targetPath);
    if (!normalizedTarget.startsWith(normalizedBase)) {
        throw new Error('Pfadverletzung erkannt: Ziel liegt außerhalb des Installationspfads.');
    }
    return normalizedTarget;
}
function sanitizeEntryPath(entryPath) {
    const sanitized = entryPath.replace(/^\/+/, '').replace(/\\/g, '/');
    if (sanitized.includes('..')) {
        throw new Error(`Unerlaubter Eintrag im Archiv: ${entryPath}`);
    }
    return sanitized;
}
async function fetchJson(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} bei ${url}`);
    }
    return response.json();
}
async function fetchAndVerifyFile(url, targetPath, expectedSha1, expectedSize) {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) {
        throw new Error(`Download fehlgeschlagen: ${response.status} ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (expectedSize && buffer.length !== expectedSize) {
        throw new Error(`Dateigröße stimmt nicht: erwartet ${expectedSize}, erhalten ${buffer.length}.`);
    }
    if (expectedSha1) {
        const hash = require('node:crypto').createHash('sha1').update(buffer).digest('hex');
        if (hash !== expectedSha1.toLowerCase()) {
            throw new Error('Prüfsumme des Downloads stimmt nicht überein.');
        }
    }
    await (0, promises_1.mkdir)(targetPath.substring(0, targetPath.lastIndexOf('/')), { recursive: true });
    await (0, promises_1.writeFile)(targetPath, buffer);
    return targetPath;
}
function buildVersionAssetList(metadata) {
    const assets = [];
    if (metadata.client?.url) {
        assets.push({
            url: metadata.client.url,
            path: 'versions/' + metadata.id + '/' + metadata.id + '.jar',
            sha1: metadata.client.sha1,
            size: metadata.client.size,
        });
    }
    for (const library of metadata.libraries ?? []) {
        const artifact = library.downloads?.artifact;
        if (artifact?.url) {
            assets.push({
                url: artifact.url,
                path: sanitizeEntryPath(`libraries/${library.name ?? 'library'}`),
                sha1: artifact.sha1,
                size: artifact.size,
            });
        }
    }
    return assets;
}
function resolveVersionMetadata(versionId) {
    const parsed = (0, instance_manager_1.parseVersionId)(versionId);
    if (!parsed || (parsed.major === 1 && parsed.minor < 20)) {
        throw new Error('Diese Version wird nicht unterstützt: nur 1.20.0+ ist erlaubt.');
    }
    return {
        id: versionId,
        type: 'release',
        releaseTime: new Date().toISOString(),
        url: `https://piston-meta.mojang.com/mc/game/version_manifest_v2.json`,
        libraries: [],
    };
}
async function installVersion(target) {
    const versionCheck = (0, instance_manager_1.evaluateJavaRequirement)(target.versionId);
    if (!versionCheck.compatible) {
        throw new Error(`Keine kompatible Java-Version für ${target.versionId}.`);
    }
    const installDir = validateSafePath(target.path, `instances/${target.versionId}_${target.loader}`);
    await (0, promises_1.mkdir)(installDir, { recursive: true });
    const metadataPath = (0, node_path_1.join)(installDir, 'version.json');
    const manifest = resolveVersionMetadata(target.versionId);
    await (0, promises_1.writeFile)(metadataPath, JSON.stringify({
        id: manifest.id,
        type: manifest.type,
        loader: target.loader,
        loaderVersion: target.loaderVersion,
        memoryMb: target.memoryMb,
        javaMajor: versionCheck.requiredJavaMajor,
        installedAt: new Date().toISOString(),
    }, null, 2), 'utf8');
    return {
        installDir,
        metadataPath,
        status: 'installed',
    };
}
function ensureVersionMetadataFile(filePath, content) {
    return (0, promises_1.writeFile)(filePath, content, 'utf8');
}
async function validateManifestIntegrity(manifestPath) {
    try {
        const raw = await (0, promises_1.readFile)(manifestPath, 'utf8');
        const parsed = JSON.parse(raw);
        return !!parsed && typeof parsed.id === 'string' && typeof parsed.loader === 'string';
    }
    catch {
        return false;
    }
}
