import type { CatalogProject } from '../types/project';
import type { GlobalStoreApi as GlobalStore } from './globalStore';

export type CatalogSortKey = 'lastEdited' | 'lastOpened' | 'created' | 'name' | 'tags';

export class CatalogStore {
  constructor(private readonly store: GlobalStore) {}

  async list(): Promise<CatalogProject[]> {
    const data = await this.store.read();
    return data.catalog;
  }

  async upsert(project: Omit<CatalogProject, 'id' | 'createdAt'> & Partial<Pick<CatalogProject, 'id' | 'createdAt'>>): Promise<CatalogProject> {
    return this.store.update((data) => {
      const now = new Date().toISOString();
      const existingIndex = data.catalog.findIndex((p) => p.path === project.path);
      if (existingIndex >= 0) {
        const updated: CatalogProject = {
          ...data.catalog[existingIndex],
          name: project.name,
          tags: project.tags,
          lastEditedAt: now,
        };
        data.catalog[existingIndex] = updated;
        return updated;
      }
      const created: CatalogProject = {
        id: project.id ?? generateId(),
        name: project.name,
        path: project.path,
        tags: project.tags,
        createdAt: project.createdAt ?? now,
      };
      data.catalog.push(created);
      return created;
    });
  }

  async recordOpened(id: string): Promise<void> {
    await this.store.update((data) => {
      const index = data.catalog.findIndex((p) => p.id === id);
      if (index >= 0) data.catalog[index] = { ...data.catalog[index], lastOpenedAt: new Date().toISOString() };
    });
  }

  async updatePath(id: string, newPath: string): Promise<void> {
    await this.store.update((data) => {
      const index = data.catalog.findIndex((p) => p.id === id);
      if (index >= 0) data.catalog[index] = { ...data.catalog[index], path: newPath, lastEditedAt: new Date().toISOString() };
    });
  }

  async remove(id: string): Promise<void> {
    await this.store.update((data) => {
      data.catalog = data.catalog.filter((p) => p.id !== id);
    });
  }

  async findByPath(path: string): Promise<CatalogProject | undefined> {
    const data = await this.store.read();
    return data.catalog.find((p) => p.path === path);
  }

  sort(catalog: CatalogProject[], key: CatalogSortKey): CatalogProject[] {
    const clone = [...catalog];
    switch (key) {
      case 'name':
        return clone.sort((a, b) => a.name.localeCompare(b.name));
      case 'tags':
        return clone.sort((a, b) => a.tags.join(',').localeCompare(b.tags.join(',')));
      case 'created':
        return clone.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      case 'lastOpened':
        return clone.sort((a, b) =>
          (b.lastOpenedAt ?? b.createdAt).localeCompare(a.lastOpenedAt ?? a.createdAt)
        );
      case 'lastEdited':
      default:
        return clone.sort((a, b) =>
          (b.lastEditedAt ?? b.createdAt).localeCompare(a.lastEditedAt ?? a.createdAt)
        );
    }
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
