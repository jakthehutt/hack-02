// The one seam between the dashboard and the backend.
//
// Today this returns a static fixture snapshotted from the pipeline outputs
// (narratives_cross.json, rt_de/narratives_report.json, edges.jsonl, the crawl
// manifest, sources.json, narratives.json). When the backend lands, replace the
// body of useDashboardData with the real fetch and keep the returned shape:
//
//   { meta, weeks[], series[], sources[], upstream[], edges[], dsn_narratives[], dsn_meta }
//
// Every view reads only from this hook, so nothing else needs to change.
import fixture from './fixture.json';

export function useDashboardData() {
  return { data: fixture, loading: false, error: null };
}
