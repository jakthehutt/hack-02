// The one seam between the presentation layer and the analysis.
//
// `@bundle` is the published bundle (../bundles/latest.json by default; see
// vite.config.js and ../bundles/README.md for the shape):
//
//   { meta, weeks[], series[], sources[], upstream[], edges[], dsn_narratives[], dsn_meta }
//
// Every view reads only from this hook, so a live backend later only has to
// replace the body here and keep the returned shape.
import bundle from '@bundle';

export function useDashboardData() {
  return { data: bundle, loading: false, error: null };
}
