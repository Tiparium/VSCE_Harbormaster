import * as vscode from 'vscode';
import type { AccentZones } from '../types/color';
import { deriveColors, ALL_ACCENT_KEYS } from './accentSystem';
import { normalizeHex } from './colorMath';

export class AccentManager {
  async apply(folder: vscode.WorkspaceFolder, zones: AccentZones): Promise<void> {
    const normalized: AccentZones = {
      frame: normalizeHex(zones.frame),
      accent: normalizeHex(zones.accent),
      surface: normalizeHex(zones.surface),
    };

    const derived = deriveColors(normalized);
    const config = vscode.workspace.getConfiguration('workbench', folder.uri);
    const existing = config.get<Record<string, unknown>>('colorCustomizations') ?? {};
    const current = typeof existing === 'object' ? { ...existing } : {};

    if (Object.keys(derived).length === 0) {
      const cleaned = this.removeAccentKeys(current);
      if (cleaned.changed) {
        await config.update('colorCustomizations', cleaned.result, vscode.ConfigurationTarget.Workspace);
      }
      return;
    }

    const next: Record<string, unknown> = { ...current };
    for (const key of ALL_ACCENT_KEYS) {
      if (!(key in derived) && key in next) {
        delete next[key];
      }
    }
    Object.assign(next, derived);

    const changed = this.hasChanged(current, next);
    if (changed) {
      await config.update('colorCustomizations', next, vscode.ConfigurationTarget.Workspace);
    }
  }

  async clear(folder: vscode.WorkspaceFolder): Promise<void> {
    const config = vscode.workspace.getConfiguration('workbench', folder.uri);
    const existing = config.get<Record<string, unknown>>('colorCustomizations') ?? {};
    const current = typeof existing === 'object' ? { ...existing } : {};
    const cleaned = this.removeAccentKeys(current);
    if (cleaned.changed) {
      await config.update('colorCustomizations', cleaned.result, vscode.ConfigurationTarget.Workspace);
    }
  }

  private removeAccentKeys(current: Record<string, unknown>): { result: Record<string, unknown>; changed: boolean } {
    let changed = false;
    const result = { ...current };
    for (const key of ALL_ACCENT_KEYS) {
      if (key in result) {
        delete result[key];
        changed = true;
      }
    }
    return { result, changed };
  }

  private hasChanged(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return true;
    return aKeys.some((k) => a[k] !== b[k]) || bKeys.some((k) => !(k in a));
  }
}
