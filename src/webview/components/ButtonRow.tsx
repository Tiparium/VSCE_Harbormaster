import React from 'react';

type Props = {
  children: React.ReactNode;
};

/** Lays out buttons side by side with equal width. */
export function ButtonRow({ children }: Props) {
  return <div className="hm-btn-row">{children}</div>;
}
