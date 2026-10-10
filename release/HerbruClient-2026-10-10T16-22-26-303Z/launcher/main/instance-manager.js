"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstanceManager = void 0;
exports.parseVersionId = parseVersionId;
exports.evaluateJavaRequirement = evaluateJavaRequirement;
exports.normalizeLoader = normalizeLoader;
exports.isLoaderSupported = isLoaderSupported;
exports.checkLoaderCompatibility = checkLoaderCompatibility;
exports.createInstanceProfile = createInstanceProfile;
exports.createInstallPlan = createInstallPlan;
function parseVersionId(versionId) {
    if (!versionId || typeof versionId !== 'string')
        return null;
    const match = /^([0-9]+)\.([0-9]+)(?:\.([0-9]+))?(?:[-.][A-Za-z0-9.-]+)?$/.exec(versionId.trim());
    if (!match)
        return null;
    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3] ?? 0),
    };
}
function evaluateJavaRequirement(versionId) {
    const parsed = parseVersionId(versionId);
    if (!parsed) {
        return { requiredJavaMajor: 17, recommendedMemoryMb: 2048, compatible: false };
    }
    const requiresJava21 = parsed.major > 1 || (parsed.major === 1 && parsed.minor >= 21);
    const requiredJavaMajor = requiresJava21 ? 21 : 17;
    const recommendedMemoryMb = requiredJavaMajor >= 21 ? 4096 : 2048;
    return {
        requiredJavaMajor,
        recommendedMemoryMb,
        compatible: requiredJavaMajor >= 17,
    };
}
function normalizeLoader(loader) {
    const normalized = loader.trim().toLowerCase();
    if (normalized === 'fabric' || normalized === 'forge' || normalized === 'neoforge' || normalized === 'quilt') {
        return normalized;
    }
    return 'unknown';
}
function isLoaderSupported(loader) {
    return normalizeLoader(loader) !== 'unknown';
}
function checkLoaderCompatibility(versionId, loader) {
    const version = parseVersionId(versionId);
    const normalized = normalizeLoader(loader);
    if (!version) {
        return { supported: false, requiredJavaMajor: 17, recommendedMemoryMb: 2048, reason: 'Unsupported version format.' };
    }
    if (version.major < 1 || (version.major === 1 && version.minor < 20)) {
        return { supported: false, requiredJavaMajor: 17, recommendedMemoryMb: 2048, reason: 'Minecraft 1.20.0+ is required.' };
    }
    if (normalized === 'unknown') {
        return { supported: false, requiredJavaMajor: 17, recommendedMemoryMb: 2048, reason: 'Unsupported loader for this instance.' };
    }
    const javaRequirement = evaluateJavaRequirement(versionId);
    return {
        supported: true,
        requiredJavaMajor: javaRequirement.requiredJavaMajor,
        recommendedMemoryMb: javaRequirement.recommendedMemoryMb,
    };
}
function createInstanceProfile(input) {
    const javaRequirement = evaluateJavaRequirement(input.versionId);
    const compatibility = checkLoaderCompatibility(input.versionId, input.loader);
    return {
        ...input,
        javaMajor: javaRequirement.requiredJavaMajor,
        createdAt: new Date().toISOString(),
        status: compatibility.supported && javaRequirement.compatible ? 'ready' : 'invalid',
    };
}
function createInstallPlan(input) {
    const version = parseVersionId(input.versionId);
    if (!version) {
        return {
            compatible: false,
            versionId: input.versionId,
            loader: input.loader,
            loaderVersion: input.loaderVersion,
            memoryMb: input.memoryMb,
            requiredSteps: ['version-check'],
            blockerReason: 'Unsupported version format.',
        };
    }
    const minimumVersion = version.major > 1 || (version.major === 1 && version.minor >= 20);
    if (!minimumVersion) {
        return {
            compatible: false,
            versionId: input.versionId,
            loader: input.loader,
            loaderVersion: input.loaderVersion,
            memoryMb: input.memoryMb,
            requiredSteps: ['version-check'],
            blockerReason: 'Minecraft 1.20.0+ is required.',
        };
    }
    const compatibility = checkLoaderCompatibility(input.versionId, input.loader);
    if (!compatibility.supported) {
        return {
            compatible: false,
            versionId: input.versionId,
            loader: input.loader,
            loaderVersion: input.loaderVersion,
            memoryMb: input.memoryMb,
            requiredSteps: ['version-check', 'loader-check'],
            blockerReason: compatibility.reason,
        };
    }
    const javaRequirement = evaluateJavaRequirement(input.versionId);
    const basePlan = {
        compatible: true,
        versionId: input.versionId,
        loader: input.loader,
        loaderVersion: input.loaderVersion,
        memoryMb: input.memoryMb,
        requiredSteps: ['version-check', 'loader-check', 'java-check', 'instance-create'],
    };
    if (input.memoryMb < javaRequirement.recommendedMemoryMb) {
        return {
            ...basePlan,
            blockerReason: undefined,
        };
    }
    return basePlan;
}
class InstanceManager {
    instances = [];
    createInstance(input) {
        const plan = createInstallPlan({
            versionId: input.versionId,
            loader: input.loader,
            loaderVersion: input.loaderVersion,
            memoryMb: input.memoryMb,
        });
        if (!plan.compatible) {
            throw new Error(plan.blockerReason ?? 'Instance configuration is not compatible.');
        }
        const profile = createInstanceProfile(input);
        this.instances.push(profile);
        return profile;
    }
    listInstances() {
        return [...this.instances];
    }
    findInstanceById(id) {
        return this.instances.find((instance) => instance.id === id);
    }
    duplicateInstance(id, newId) {
        const original = this.findInstanceById(id);
        if (!original) {
            throw new Error(`Instance ${id} not found.`);
        }
        const clone = {
            ...original,
            id: newId,
            name: `${original.name} (Kopie)`,
            createdAt: new Date().toISOString(),
        };
        this.instances.push(clone);
        return clone;
    }
    renameInstance(id, newName) {
        const instance = this.findInstanceById(id);
        if (!instance) {
            throw new Error(`Instance ${id} not found.`);
        }
        instance.name = newName;
        return instance;
    }
    deleteInstance(id) {
        const index = this.instances.findIndex((instance) => instance.id === id);
        if (index === -1)
            return false;
        this.instances.splice(index, 1);
        return true;
    }
    repairInstance(id) {
        const instance = this.findInstanceById(id);
        if (!instance) {
            throw new Error(`Instance ${id} not found.`);
        }
        const plan = createInstallPlan({
            versionId: instance.versionId,
            loader: instance.loader,
            loaderVersion: instance.loaderVersion,
            memoryMb: instance.memoryMb,
        });
        instance.status = plan.compatible ? 'ready' : 'invalid';
        return instance;
    }
}
exports.InstanceManager = InstanceManager;
