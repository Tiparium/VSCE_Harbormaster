import React from 'react';

type Props = {
  label: string;
  command: string;
  primary?: boolean;
};

export function ActionButton({ label, command, primary = false }: Props) {
  function handleClick() {
    window.__hm_send?.({ type: 'command', command });
  }

  return (
    <button
      className={primary ? 'hm-btn hm-btn--primary' : 'hm-btn'}
      onClick={handleClick}
    >
      {label}
    </button>
  );
}
