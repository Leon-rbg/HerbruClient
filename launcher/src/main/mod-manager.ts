export type ProviderStatus = 'ready' | 'offline' | 'not-configured' | 'unsupported';

export interface ModProvider {
  id: string;
  name: string;
  status: ProviderStatus;
  endpoint?: string;
}

export interface ModInstallInput {
  id: string;
  name: string;
  provider: string;
  version: string;
  minecraftVersion: string;
  loader: string;
  description?: string;
}

export interface ModEntry extends ModInstallInput {
  installationStatus: 'installed' | 'removed' | 'update-available';
  installedAt: string;
}

export class ModManager {
  public providers = new Map<string, ModProvider>();
  public installedMods = new Map<string, ModEntry>();

  public registerProvider(provider: ModProvider): ModProvider {
    this.providers.set(provider.id, provider);
    return provider;
  }

  public getProviderStatus(providerId: string): ModProvider {
    const existing = this.providers.get(providerId);
    if (existing) return existing;
    const fallback: ModProvider = { id: providerId, name: providerId, status: 'not-configured' };
    this.providers.set(providerId, fallback);
    return fallback;
  }

  public listProviders(): ModProvider[] {
    return [...this.providers.values()];
  }

  public installMod(input: ModInstallInput): ModEntry {
    const provider = this.getProviderStatus(input.provider);
    if (provider.status === 'not-configured' || provider.status === 'unsupported') {
      throw new Error(`Provider ${input.provider} ist für Installation nicht konfiguriert.`);
    }

    const entry: ModEntry = {
      ...input,
      installationStatus: 'installed',
      installedAt: new Date().toISOString(),
    };
    this.installedMods.set(entry.id, entry);
    return entry;
  }

  public listInstalledMods(): ModEntry[] {
    return [...this.installedMods.values()];
  }

  public search(query: string): ModEntry[] {
    const normalised = query.trim().toLowerCase();
    if (!normalised) return this.listInstalledMods();
    return this.listInstalledMods().filter((mod) => {
      return mod.name.toLowerCase().includes(normalised)
        || mod.description?.toLowerCase().includes(normalised)
        || mod.provider.toLowerCase().includes(normalised)
        || mod.minecraftVersion.toLowerCase().includes(normalised);
    });
  }

  public removeMod(id: string): boolean {
    return this.installedMods.delete(id);
  }
}
