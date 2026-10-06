import { RELATIONS } from '../../../data/derive.js';
import { plain } from '../../insights.js';

export const ALL_RELATIONS = new Set(RELATIONS.map(r => r.id));

export default {
  id: 'propagation-flow',
  title: 'Who repeats whom',
  description: 'Outlets in catalogue columns from Moscow wires to DACH relays; a line is a pickup route, its width the number of pickups. Observed routes solid, estimated dashed.',
  job: 'flow',
  sizes: { min: { w: 4, h: 2 }, max: { w: 6, h: 5 }, presets: ['6x3', '6x2', '6x4', '4x3'] },
  params: {
    observedOnly: { type: 'bool', label: 'Observed pickups only', default: false },
  },
  requires: bundle => bundle.edges.filter(e => e.from_source_id !== e.to_source_id).length >= 3 || 'needs at least three pickups',
  usesEstimates: (bundle, params) => !params.observedOnly && bundle.edges.some(e => e.synthetic),
  suggest(bundle, insights) {
    const hub = insights.find(i => i.kind === 'hub');
    const observed = bundle.edges.filter(e => !e.synthetic && e.from_source_id !== e.to_source_id).length;
    return [{
      params: {},
      size: '6x3',
      score: observed >= 5 ? 0.6 : 0.48,
      reason: hub ? plain(hub.sentence) : `${bundle.edges.length} pickups between outlets.`,
    }];
  },
};
