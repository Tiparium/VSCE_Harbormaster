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
          <ActionButton label="Color Settings" command="harbormaster.setAccent" />
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
