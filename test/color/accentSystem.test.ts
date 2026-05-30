import { describe, it, expect } from 'vitest';
import { deriveColors } from '../../src/color/accentSystem';

describe('deriveColors', () => {
  it('returns empty object for empty zones', () => {
    expect(deriveColors({})).toEqual({});
  });

  it('derives frame colors from frame zone', () => {
    const result = deriveColors({ frame: '#1E3643' });
    expect(result['titleBar.activeBackground']).toBe('#1E3643');
    expect(result['activityBar.background']).toBe('#1E3643');
    expect(result['titleBar.activeForeground']).toBe('#FFFFFF');
  });

  it('derives accent colors from accent zone', () => {
    const result = deriveColors({ accent: '#00A6FF' });
    expect(result['activityBarBadge.background']).toBe('#00A6FF');
    expect(result['button.background']).toBe('#00A6FF');
    expect(result['editorCursor.foreground']).toBe('#00A6FF');
    expect(result['activityBar.activeBorder']).toBe('#00A6FF');
  });

  it('derives surface colors from surface zone', () => {
    const result = deriveColors({ surface: '#1F1F1F' });
    expect(result['sideBar.background']).toBe('#1F1F1F');
    expect(result['panel.background']).toBeTruthy();
  });

  it('combines all three zones', () => {
    const result = deriveColors({ frame: '#1E3643', accent: '#00A6FF', surface: '#1F1F1F' });
    expect(result['titleBar.activeBackground']).toBe('#1E3643');
    expect(result['button.background']).toBe('#00A6FF');
    expect(result['sideBar.background']).toBe('#1F1F1F');
  });

  it('ignores invalid hex values', () => {
    const result = deriveColors({ frame: 'notacolor', accent: '#00A6FF' });
    expect(result['titleBar.activeBackground']).toBeUndefined();
    expect(result['button.background']).toBe('#00A6FF');
  });
});
