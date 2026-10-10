export type SupportedLoader = 'fabric' | 'forge' | 'neoforge' | 'quilt';

export interface JavaRequirement {
  requiredJavaMajor: number;
  recommendedMemoryMb: number;
  compatible: boolean;
}

export interface LoaderCompatibility {
  supported: boolean;
  requiredJavaMajor: number;
  recommendedMemoryMb: number;
  reason?: string;
}

export interface InstanceProfileInput {
  id: string;
  name: string;
  versionId: string;
  loader: SupportedLoader | string;
  loaderVersion: string;
  memoryMb: number;
}

export interface InstanceProfile extends InstanceProfileInput {
  javaMajor: number;
  createdAt: string;
  status: 'ready' | 'invalid';
}

export interface InstallPlanInput {
  versionId: string;
  loader: SupportedLoader | string;
  loaderVersion: string;
  memoryMb: number;
}

export interface InstallPlan {
  compatible: boolean;
  versionId: string;
  loader: string;
  loaderVersion: string;
  memoryMb: number;
  requiredSteps: string[];
  blockerReason?: string;
}

export function parseVersionId(versionId: string): { major: number; minor: number; patch: number } | null {
  if (!versionId || typeof versionId !== 'string') return null;
  const match = /^([0-9]+)\.([0-9]+)(?:\.([0-9]+))?(?:[-.][A-Za-z0-9.-]+)?$/.exec(versionId.trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3] ?? 0),
  };
}

export function evaluateJavaRequirement(versionId: string): JavaRequirement {
  const parsed = parseVersionId(versionId);
  if (!parsed) {
    return { requiredJavaMajor: 17, recommendedMemoryMb: 2048, compatible: false };
  }

  const requiresJava25 = parsed.major >= 26;
  const requiresJava21 = parsed.major > 1 || (parsed.major === 1 && (parsed.minor >= 21 || (parsed.minor === 20 && parsed.patch >= 5)));
  const requiredJavaMajor = requiresJava25 ? 25 : requiresJava21 ? 21 : 17;
  const recommendedMemoryMb = requiredJavaMajor >= 21 ? 4096 : 2048;

  return {
    requiredJavaMajor,
    recommendedMemoryMb,
    compatible: requiredJavaMajor >= 17,
  };
}

export function normalizeLoader(loader: string): SupportedLoader | 'unknown' {
  const normalized = loader.trim().toLowerCase();
  if (normalized === 'fabric' || normalized === 'forge' || normalized === 'neoforge' || normalized === 'quilt') {
    return normalized as SupportedLoader;
  }
  return 'unknown';
}

export function isLoaderSupported(loader: string): boolean {
  return normalizeLoader(loader) !== 'unknown';
}

export function checkLoaderCompatibility(versionId: string, loader: string): LoaderCompatibility {
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

export function createInstanceProfile(input: InstanceProfileInput): InstanceProfile {
  const javaRequirement = evaluateJavaRequirement(input.versionId);
  const compatibility = checkLoaderCompatibility(input.versionId, input.loader);
  return {
    ...input,
    javaMajor: javaRequirement.requiredJavaMajor,
    createdAt: new Date().toISOString(),
    status: compatibility.supported && javaRequirement.compatible ? 'ready' : 'invalid',
  };
}

export function createInstallPlan(input: InstallPlanInput): InstallPlan {
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
  const basePlan: InstallPlan = {
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

export class InstanceManager {
  public instances: InstanceProfile[] = [];

  public createInstance(input: InstanceProfileInput): InstanceProfile {
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

  public listInstances(): InstanceProfile[] {
    return [...this.instances];
  }

  public findInstanceById(id: string): InstanceProfile | undefined {
    return this.instances.find((instance) => instance.id === id);
  }

  public duplicateInstance(id: string, newId: string): InstanceProfile {
    const original = this.findInstanceById(id);
    if (!original) {
      throw new Error(`Instance ${id} not found.`);
    }

    const clone: InstanceProfile = {
      ...original,
      id: newId,
      name: `${original.name} (Kopie)`,
      createdAt: new Date().toISOString(),
    };
    this.instances.push(clone);
    return clone;
  }

  public renameInstance(id: string, newName: string): InstanceProfile {
    const instance = this.findInstanceById(id);
    if (!instance) {
      throw new Error(`Instance ${id} not found.`);
    }

    instance.name = newName;
    return instance;
  }

  public deleteInstance(id: string): boolean {
    const index = this.instances.findIndex((instance) => instance.id === id);
    if (index === -1) return false;
    this.instances.splice(index, 1);
    return true;
  }

  public repairInstance(id: string): InstanceProfile {
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
