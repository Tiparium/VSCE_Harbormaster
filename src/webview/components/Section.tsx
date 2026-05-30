import React from 'react';

type Props = {
  title?: string;
  children: React.ReactNode;
};

export function Section({ title, children }: Props) {
  return (
    <div className="hm-section">
      {title && <div className="hm-section__title">{title}</div>}
      <div className="hm-section__body">{children}</div>
    </div>
  );
}
