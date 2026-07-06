import React, { useState, useEffect } from 'react';
import type { SidebarData, ExtensionMessage } from './types';
import { Header } from './components/Header';
import { SidebarCanvas } from './components/SidebarCanvas';
import { Section } from './components/Section';
import { ActionButton } from './components/ActionButton';
import { ButtonRow } from './components/ButtonRow';

const DEFAULT_DATA: SidebarData = {
  projectName: '',
  version: '',
  tags: [],
  isHarbormasterProject: false,
  activeAiTools: [],
  registeredMcpTools: [],
  accent: {},
};

export function App() {
  const [data, setData] = useState<SidebarData>(DEFAULT_DATA);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const msg = event.data as ExtensionMessage;
      if (msg.type === 'update') {
        setData(msg.data);
      }
    }
    window.addEventListener('message', handleMessage);
    window.__hm_send?.({ type: 'ready' });
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const hasMcpGap = data.activeAiTools.some((t) => !data.registeredMcpTools.includes(t));
  const zones = [
    { id: 'frame' as const, label: 'Frame' },
    { id: 'accent' as const, label: 'Accent' },
    { id: 'surface' as const, label: 'Surface' },
  ];

  return (
    <div className="hm-root">
      <Header
        projectName={data.projectName}
        version={data.version}
        tags={data.tags}
      />
      <SidebarCanvas>

        {/* ── Project actions ───────────────────────────────────────────── */}
        <Section>
          {data.isHarbormasterProject ? (
            <ButtonRow layout="compact-first">
              <ActionButton label="New Project" command="harbormaster.createProject" compact />
              <ActionButton label="Open Project" command="harbormaster.openCatalog" primary />
            </ButtonRow>
          ) : (
            <ButtonRow layout="equal">
              <ActionButton label="New Project" command="harbormaster.createProject" primary />
              <ActionButton label="Open Project" command="harbormaster.openCatalog" primary />
            </ButtonRow>
          )}
        </Section>

        <Section title="Accent Colors">
          <div className="hm-accent-grid">
            {zones.map((zone) => (
              <label className="hm-accent-zone" key={zone.id}>
                <span>{zone.label}</span>
                <span className="hm-accent-controls">
                  <input
                    type="color"
                    value={data.accent[zone.id] ?? '#1e1e1e'}
                    onChange={(event) => window.__hm_send?.({
                      type: 'setAccentZone',
                      zone: zone.id,
                      value: event.target.value,
                    })}
                  />
                  <button
                    className="hm-btn hm-btn--compact"
                    aria-label={`Clear ${zone.label}`}
                    title={`Clear ${zone.label}`}
                    disabled={!data.accent[zone.id]}
                    onClick={() => window.__hm_send?.({ type: 'setAccentZone', zone: zone.id })}
                  >
                    ×
                  </button>
                </span>
              </label>
            ))}
            <button className="hm-btn" onClick={() => window.__hm_send?.({ type: 'clearAccent' })}>
              Clear all accents
            </button>
          </div>
        </Section>

        {/* ── Settings ─────────────────────────────────────────────────── */}
        <Section title="Settings">
          <ActionButton label="Manage AI Tools" command="harbormaster.manageAiTools" />
          <ActionButton
            label={hasMcpGap ? 'MCP Registration ⚠' : 'MCP Registration'}
            command="harbormaster.manageMcp"
          />
        </Section>

      </SidebarCanvas>
    </div>
  );
}
