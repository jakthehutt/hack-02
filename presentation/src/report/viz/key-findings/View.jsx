import React from 'react';
import { FitText, Markdown } from '../../markdown.jsx';
import { Empty } from '../../draw.jsx';
import { pickFindings } from './meta.js';

export default function KeyFindings({ bundle, params, filters }) {
  const items = pickFindings(bundle, filters, { count: Number(params.count) || 4, provenance: params.provenance !== false });
  if (!items.length) return <Empty>Nothing stands out in this period.</Empty>;
  return (
    <FitText max={8.5}>
      <Markdown drop text={items.map(i => `- ${i.sentence}`).join('\n')} />
    </FitText>
  );
}
