import React from 'react';

type Layout =
  | 'equal'         // [  A  ][  B  ]
  | 'compact-first' // [ A ][    B    ]

type Props = {
  children: React.ReactNode;
  layout?: Layout;
};

export function ButtonRow({ children, layout = 'equal' }: Props) {
  return (
    <div className={`hm-btn-row hm-btn-row--${layout}`}>
      {children}
    </div>
  );
}
