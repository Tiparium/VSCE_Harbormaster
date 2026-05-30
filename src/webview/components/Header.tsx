import React from 'react';

type Props = {
  projectName: string;
  version: string;
  tags: string[];
};

export function Header({ projectName, version, tags }: Props) {
  return (
    <div className="hm-header">
      <div className="hm-header__top">
        <span className="hm-header__name">{projectName || 'No project'}</span>
        {version && <span className="hm-header__version">{version}</span>}
      </div>
      {tags.length > 0 && (
        <div className="hm-header__tags">
          {tags.map((tag) => (
            <span key={tag} className="hm-tag">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}
