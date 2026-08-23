import { useState } from 'react';
import { facetsOf, FacetFilter, ROWS } from 'clickup-shell';
/** Окно «критерии | значения» на настоящих фасетах реестра. */
export const Open = () => {
  const [value, setValue] = useState<Record<string, string[]>>({ status: ['open'] });
  return (
    <div style={{ height: 380 }}>
      <FacetFilter open facets={facetsOf(ROWS)} value={value} onChange={setValue} onClose={() => {}} />
    </div>
  );
};
