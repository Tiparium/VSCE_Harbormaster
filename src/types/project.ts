import type { Branch } from './global';

export type CatalogProject = {
  id: string;
  name: string;
  path: string;
  tags: string[];
  createdAt: string;
  lastOpenedAt?: string;
  lastEditedAt?: string;
};

export type ProjectConfig = {
  version: number;
  project_name: string;
  project_version: string;
  version_major: number;
  version_minor: number;
  version_patch: number;
  version_prerelease: string;
  tags: string[];
  accent?: ProjectAccent;
  /** IDs of branches active for this project. */
  activeBranches: string[];
  /** Branch definitions scoped to this project only. */
  localBranches?: Branch[];
};

export type ProjectAccent = {
  frame?: string;
  accent?: string;
  surface?: string;
};

export type HealthSnapshot = {
  missing: string[];
  corrupt: string[];
};
