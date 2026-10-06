import { KPI_ITEMS } from '../kpi-row/meta.js';

export default {
  id: 'kpi',
  title: 'One number',
  description: 'A single headline number with a weekly sparkline where weeks were observed.',
  job: 'headline',
  frame: { title: false },
  sizes: { min: { w: 1, h: 1 }, max: { w: 3, h: 2 }, presets: ['2x1', '1x1', '3x1', '2x2'] },
  params: {
    item: { type: 'enum', label: 'Number', options: KPI_ITEMS, default: 'hits' },
  },
  requires: bundle => bundle.sources.length > 0,
  suggest: () => [],
};
