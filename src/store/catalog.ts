import type { CatalogProject } from '../types/project';
import type { GlobalStore } from './globalStore';

export type CatalogSortKey = 'lastEdited' | 'lastOpened' | 'created' | 'name' | 'tags';

export class CatalogStore {
  constructor(private readonly store: GlobalStore) {}

  async list(): Promise<CatalogProject[]> {
    const data = await this.store.read();
    return data.catalog;
  }

  async upsert(project: Omit<CatalogProject, 'id' | 'createdAt'> & Partial<Pick<CatalogProject, 'id' | 'createdAt'>>): Promise<CatalogProject> {
    const data = await this.store.read();
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
      await this.store.write(data);
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
    await this.store.write(data);
    return created;
  }

  async recordOpened(id: string): Promise<void> {
    const data = await this.store.read();
    const index = data.catalog.findIndex((p) => p.id === id);
    if (index < 0) return;
    data.catalog[index] = { ...data.catalog[index], lastOpenedAt: new Date().toISOString() };
    await this.store.write(data);
  }

  async updatePath(id: string, newPath: string): Promise<void> {
    const data = await this.store.read();
    const index = data.catalog.findIndex((p) => p.id === id);
    if (index < 0) return;
    data.catalog[index] = { ...data.catalog[index], path: newPath, lastEditedAt: new Date().toISOString() };
    await this.store.write(data);
  }

  async remove(id: string): Promise<void> {
    const data = await this.store.read();
    data.catalog = data.catalog.filter((p) => p.id !== id);
    await this.store.write(data);
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
