export type ModuleVisibility = "public" | "private";

export interface ModuleDefinition {
  id: string;
  title: string;
  path: string;
  visibility: ModuleVisibility;
}

const modules = new Map<string, ModuleDefinition>();

export function registerModule(def: ModuleDefinition): void {
  if (modules.has(def.id)) {
    throw new Error(`Module already registered: ${def.id}`);
  }
  modules.set(def.id, def);
}

export function listModules(): ModuleDefinition[] {
  return [...modules.values()];
}

export function resetRegistry(): void {
  modules.clear();
}
