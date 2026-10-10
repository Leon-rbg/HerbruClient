"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModManager = void 0;
class ModManager {
    providers = new Map();
    installedMods = new Map();
    registerProvider(provider) {
        this.providers.set(provider.id, provider);
        return provider;
    }
    getProviderStatus(providerId) {
        const existing = this.providers.get(providerId);
        if (existing)
            return existing;
        const fallback = { id: providerId, name: providerId, status: 'not-configured' };
        this.providers.set(providerId, fallback);
        return fallback;
    }
    listProviders() {
        return [...this.providers.values()];
    }
    installMod(input) {
        const provider = this.getProviderStatus(input.provider);
        if (provider.status === 'not-configured' || provider.status === 'unsupported') {
            throw new Error(`Provider ${input.provider} ist für Installation nicht konfiguriert.`);
        }
        const entry = {
            ...input,
            installationStatus: 'installed',
            installedAt: new Date().toISOString(),
        };
        this.installedMods.set(entry.id, entry);
        return entry;
    }
    listInstalledMods() {
        return [...this.installedMods.values()];
    }
    search(query) {
        const normalised = query.trim().toLowerCase();
        if (!normalised)
            return this.listInstalledMods();
        return this.listInstalledMods().filter((mod) => {
            return mod.name.toLowerCase().includes(normalised)
                || mod.description?.toLowerCase().includes(normalised)
                || mod.provider.toLowerCase().includes(normalised)
                || mod.minecraftVersion.toLowerCase().includes(normalised);
        });
    }
    removeMod(id) {
        return this.installedMods.delete(id);
    }
}
exports.ModManager = ModManager;
