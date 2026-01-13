export class ChartEngine {
  generateSmoothPath(data, width, height, padding = 20, opts = {}) {
    if (!data || data.length < 2) return "";

    const min = opts.min !== undefined ? opts.min : Math.min(...data);
    const max = opts.max !== undefined ? opts.max : Math.max(...data);

    const range = max - min || 1;

    const drawW = width - padding * 2;
    const drawH = height - padding * 2;

    const stepX = drawW / (data.length - 1);

    const points = data.map((val, i) => {
      const nullVal = val === null ? min : val;

      const normY = (nullVal - min) / range;

      const x = padding + i * stepX;

      const y = height - padding - normY * drawH;

      return { x, y };
    });

    let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p_next = points[i + 1];

      d += ` L ${p_next.x.toFixed(1)} ${p_next.y.toFixed(1)}`;
    }

    return d;
  }
}
