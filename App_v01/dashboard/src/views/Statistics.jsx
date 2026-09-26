import React from 'react';
import { ForestPlot, VolumeShareChart, CompositionChart, LagEcdf, RankGradient } from '../components/StatCharts.jsx';
import { shortName } from '../components/Heatmap.jsx';
import {
  forestRows, volumeShare, matchComposition, lagEcdf, rankGradient,
  rankedSources, visibleSeries, weeklyObserved,
} from '../data/derive.js';

export function Statistics({ data, filters, focus, setFocus }) {
  const { lo, hi, kind, metric } = filters;
  const list = rankedSources(data);
  const source = list.find(s => s.id === focus.source) || list[0];
  const seriesList = visibleSeries(data, kind);
  const series = seriesList.find(s => s.id === focus.series) || seriesList[0];
  const rows = forestRows(data, source, kind, lo, hi);
  const volume = volumeShare(data, source, series?.id, lo, hi);
  const composition = matchComposition(data, source, kind, lo, hi);
  const ecdf = React.useMemo(() => lagEcdf(data.edges), [data.edges]);
  const ranks = rankGradient(data, kind);

  return (
    <>
      <p className="note" style={{ margin: 0 }}>
        Counts are articles, not deduped copy-clusters. The claims pipeline uses copy-clusters; those files are not in this fixture.
      </p>
      <div className="legend" role="group" aria-label="Outlet">
        {list.map(s => (
          <button key={s.id} className="chip" aria-pressed={s.id === source?.id} onClick={() => setFocus({ ...focus, source: s.id })}>
            {shortName(s)}<span className="n">{weeklyObserved(s) ? 'weekly' : 'totals'}</span>
          </button>
        ))}
      </div>
      <ForestPlot
        rows={rows}
        metric={metric}
        selectedId={series?.id}
        onSelect={id => setFocus({ ...focus, series: id })}
      />
      <div className="grid grid-2-even">
        <VolumeShareChart model={volume} seriesLabel={series?.label || 'this frame'} />
        <CompositionChart model={composition} />
      </div>
      <div className="grid grid-2-even">
        <LagEcdf ecdf={ecdf} />
        <RankGradient model={ranks} />
      </div>
    </>
  );
}
