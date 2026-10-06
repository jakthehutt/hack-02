import React from 'react';
import { Markdown, FitText } from '../../markdown.jsx';

export default function TextBlock({ params }) {
  return (
    <FitText max={Number(params.size) || 9}>
      <Markdown text={params.md} />
    </FitText>
  );
}
