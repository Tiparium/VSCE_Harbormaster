import React from 'react';

type Props = {
  children: React.ReactNode;
};

/**
 * The main content area of the sidebar.
 * Children are components rendered in order — adding a new component
 * to the sidebar means adding a child here.
 */
export function SidebarCanvas({ children }: Props) {
  return <div className="hm-canvas">{children}</div>;
}
