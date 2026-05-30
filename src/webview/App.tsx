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

  return (
    <div className="hm-root">
      <Header
        projectName={data.projectName}
        version={data.version}
        tags={data.tags}
      />
      <SidebarCanvas>
        <Section>
          {data.isHarbormasterProject ? (
            // In a Harbormaster project — open is primary, new project is secondary
            <>
              <ActionButton label="Open Project" command="harbormaster.openCatalog" primary />
              <ActionButton label="New Project" command="harbormaster.createProject" />
            </>
          ) : (
            // Not a Harbormaster project — both get equal prominence
            <ButtonRow>
              <ActionButton label="Open Project" command="harbormaster.openCatalog" primary />
              <ActionButton label="New Project" command="harbormaster.createProject" primary />
            </ButtonRow>
          )}
          <ActionButton label="Color Settings" command="harbormaster.setAccent" />
        </Section>
      </SidebarCanvas>
    </div>
  );
}
