import { useState } from 'react';
import { FACETS, FacetFilter } from 'clickup-shell';
/** Окно «критерии | значения» на настоящих фасетах реестра. */
export const Open = () => {
  const [value, setValue] = useState<Record<string, string[]>>({ status: ['open'] });
  return (
    <div style={{ height: 380 }}>
      <FacetFilter open facets={FACETS} value={value} onChange={setValue} onClose={() => {}} />
    </div>
  );
};
