export default {
  id: 'text',
  title: 'Notes',
  description: 'Your own words: a lead, a method note or a call to action. Markdown-lite: **bold**, *italic*, ==highlight==, "- " lists, "## " headings. It shrinks to fit, down to 6.5 pt.',
  job: 'words',
  sizes: { min: { w: 1, h: 1 }, max: { w: 6, h: 8 }, presets: ['3x2', '6x1', '2x2', '3x3', '6x2'] },
  params: {
    md: { type: 'text', label: 'Text', multiline: true, default: 'Write the takeaway here. Keep every number traceable to the data.' },
    size: { type: 'enum', label: 'Largest size', options: [{ value: 9, label: '9 pt' }, { value: 11, label: '11 pt' }, { value: 14, label: '14 pt (lead)' }], default: 9 },
  },
  requires: () => true,
  suggest: () => [],
};
