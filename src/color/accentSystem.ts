import type { AccentZones, DerivedColors } from '../types/color';
import { normalizeHex, contrastColor, withAlpha, darken } from './colorMath';

/**
 * Derives a full set of VS Code color customization entries from
 * the three accent zones. Only zones that are set produce output.
 */
export function deriveColors(zones: AccentZones): DerivedColors {
  const colors: DerivedColors = {};
  const frame = normalizeHex(zones.frame);
  const accent = normalizeHex(zones.accent);
  const surface = normalizeHex(zones.surface);

  if (frame) {
    Object.assign(colors, deriveFrame(frame));
  }
  if (accent) {
    Object.assign(colors, deriveAccent(accent));
  }
  if (surface) {
    Object.assign(colors, deriveSurface(surface));
  }

  return colors;
}

function deriveFrame(hex: string): DerivedColors {
  const fg = contrastColor(hex);
  return {
    'titleBar.activeBackground': hex,
    'titleBar.inactiveBackground': withAlpha(hex, 0.7),
    'titleBar.activeForeground': fg,
    'titleBar.inactiveForeground': withAlpha(fg, 0.7),
    'activityBar.background': hex,
    'activityBar.foreground': fg,
    'activityBar.inactiveForeground': withAlpha(fg, 0.6),
  };
}

function deriveAccent(hex: string): DerivedColors {
  const fg = contrastColor(hex);
  const dark = darken(hex, 0.65);
  const darkFg = contrastColor(dark);
  return {
    // Tab indicators and borders
    'activityBar.activeBorder': hex,
    'activityBar.activeFocusBorder': hex,
    'tab.activeBorderTop': hex,
    'tab.activeBorder': hex,
    'tab.unfocusedActiveBorderTop': withAlpha(hex, 0.6),
    'tab.unfocusedActiveBorder': withAlpha(hex, 0.6),
    'tab.activeModifiedBorder': withAlpha(hex, 0.8),
    'panelTitle.activeBorder': hex,
    'sideBarSectionHeader.border': hex,
    // Badges and notifications
    'activityBarBadge.background': hex,
    'activityBarBadge.foreground': fg,
    // Buttons
    'button.background': hex,
    'button.hoverBackground': withAlpha(hex, 0.85),
    'button.foreground': fg,
    'badge.background': hex,
    'badge.foreground': fg,
    // Status bar (darkened variant)
    'statusBar.background': dark,
    'statusBar.foreground': darkFg,
    'statusBar.debuggingBackground': hex,
    'statusBar.debuggingForeground': fg,
    'statusBarItem.hoverBackground': withAlpha(hex, 0.25),
    'statusBar.noFolderBackground': dark,
    // Cursor
    'editorCursor.foreground': hex,
    // Selection highlights
    'editor.selectionBackground': withAlpha(hex, 0.35),
    'editor.selectionHighlightBackground': withAlpha(hex, 0.2),
    'editor.lineHighlightBackground': withAlpha(hex, 0.08),
    'list.activeSelectionBackground': withAlpha(hex, 0.35),
    'list.inactiveSelectionBackground': withAlpha(hex, 0.2),
    'list.hoverBackground': withAlpha(hex, 0.15),
    'list.focusBackground': withAlpha(hex, 0.25),
    'list.highlightForeground': hex,
  };
}

function deriveSurface(hex: string): DerivedColors {
  const fg = contrastColor(hex);
  return {
    'sideBar.background': hex,
    'sideBar.foreground': fg,
    'sideBar.border': withAlpha(hex, 0.4),
    'panel.background': withAlpha(hex, 0.08),
    'panel.border': withAlpha(hex, 0.4),
    'panelTitle.activeForeground': fg,
    'panelTitle.inactiveForeground': withAlpha(fg, 0.6),
  };
}

export const ALL_ACCENT_KEYS: ReadonlyArray<string> = [
  'titleBar.activeBackground', 'titleBar.inactiveBackground',
  'titleBar.activeForeground', 'titleBar.inactiveForeground',
  'activityBar.background', 'activityBar.foreground', 'activityBar.inactiveForeground',
  'activityBar.activeBorder', 'activityBar.activeFocusBorder',
  'tab.activeBorderTop', 'tab.activeBorder',
  'tab.unfocusedActiveBorderTop', 'tab.unfocusedActiveBorder', 'tab.activeModifiedBorder',
  'panelTitle.activeBorder', 'sideBarSectionHeader.border',
  'activityBarBadge.background', 'activityBarBadge.foreground',
  'button.background', 'button.hoverBackground', 'button.foreground',
  'badge.background', 'badge.foreground',
  'statusBar.background', 'statusBar.foreground',
  'statusBar.debuggingBackground', 'statusBar.debuggingForeground',
  'statusBarItem.hoverBackground', 'statusBar.noFolderBackground',
  'editorCursor.foreground',
  'editor.selectionBackground', 'editor.selectionHighlightBackground', 'editor.lineHighlightBackground',
  'list.activeSelectionBackground', 'list.inactiveSelectionBackground',
  'list.hoverBackground', 'list.focusBackground', 'list.highlightForeground',
  'sideBar.background', 'sideBar.foreground', 'sideBar.border',
  'panel.background', 'panel.border',
  'panelTitle.activeForeground', 'panelTitle.inactiveForeground',
];
