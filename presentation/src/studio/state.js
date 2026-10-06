// The studio's document state: the spec, the selection and an undo history. Pure.
import { normalizeSpec, nextBlockId } from '../report/spec.js';

const LIMIT = 100;

export const initialState = spec => ({ spec: normalizeSpec(spec), selected: null, past: [], future: [] });

function commit(state, spec, selected = state.selected) {
  return { spec, selected, past: [...state.past, state.spec].slice(-LIMIT), future: [] };
}

const mapBlocks = (spec, fn) => ({ ...spec, blocks: spec.blocks.map(fn) });

export function reducer(state, a) {
  switch (a.type) {
    case 'replace':
      return commit(state, normalizeSpec(a.spec), null);
    case 'page':
      return commit(state, { ...state.spec, ...a.patch, filters: { ...state.spec.filters, ...(a.patch.filters || {}) }, page: { ...state.spec.page, ...(a.patch.page || {}) } });
    case 'add': {
      const block = { ...a.block, id: a.block.id && !state.spec.blocks.some(b => b.id === a.block.id) ? a.block.id : nextBlockId(state.spec.blocks), params: { ...(a.block.params || {}) } };
      return commit(state, { ...state.spec, blocks: [...state.spec.blocks, block] }, block.id);
    }
    case 'update':
      return commit(state, mapBlocks(state.spec, b => (b.id === a.id ? { ...b, ...a.patch } : b)));
    case 'params':
      return commit(state, mapBlocks(state.spec, b => (b.id === a.id ? { ...b, params: { ...b.params, ...a.patch } } : b)));
    case 'remove':
      return commit(state, { ...state.spec, blocks: state.spec.blocks.filter(b => b.id !== a.id) }, state.selected === a.id ? null : state.selected);
    case 'select':
      return { ...state, selected: a.id };
    case 'undo':
      if (!state.past.length) return state;
      return { spec: state.past[state.past.length - 1], selected: null, past: state.past.slice(0, -1), future: [state.spec, ...state.future] };
    case 'redo':
      if (!state.future.length) return state;
      return { spec: state.future[0], selected: null, past: [...state.past, state.spec], future: state.future.slice(1) };
    default:
      return state;
  }
}
