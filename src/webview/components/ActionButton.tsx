import React from 'react';

type Props = {
  label: string;
  command: string;
  primary?: boolean;
  /** Renders as a small icon-only button. Label becomes the tooltip. */
  compact?: boolean;
};

export function ActionButton({ label, command, primary = false, compact = false }: Props) {
  function handleClick() {
    window.__hm_send?.({ type: 'command', command });
  }

  if (compact) {
    return (
      <button
        className="hm-btn hm-btn--compact"
        title={label}
        aria-label={label}
        onClick={handleClick}
      >
        +
      </button>
    );
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
