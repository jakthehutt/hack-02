import React from 'react';
import { Block } from '../report/sheet/Block.jsx';
import { cellBox, PX_PER_MM } from '../report/grid.js';
import { REGISTRY } from '../report/registry.js';

/** A real block, drawn at its true size and scaled down to the width of its card. */
export const Preview = React.memo(function Preview({ viz, params, size, bundle, filters }) {
  const ref = React.useRef(null);
  const [width, setWidth] = React.useState(220);
  React.useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(120, e.contentRect.width)));
    ro.observe(ref.current.parentElement);
    return () => ro.disconnect();
  }, []);
  const box = cellBox({ x: 0, y: 0, ...size });
  const scale = width / (box.w * PX_PER_MM);
  return (
    <div ref={ref} className="st-preview" style={{ width, height: box.h * PX_PER_MM * scale }} aria-hidden="true">
      <div className="fs-sheet st-preview-sheet" style={{ width: `${box.w}mm`, height: `${box.h}mm`, transform: `scale(${scale})` }}>
        <Block block={{ id: 'preview', viz, x: 0, y: 0, ...size, params }} bundle={bundle} filters={filters} registry={REGISTRY} />
      </div>
    </div>
  );
});
