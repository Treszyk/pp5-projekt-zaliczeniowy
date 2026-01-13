import { ChartEngine } from "../core/ChartEngine.js";

export class SkyChart extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.engine = new ChartEngine();
    this._width = 1200;
    this._height = 500;
    this._padding = 60;
    this._labels = { a: "Miasto A", b: "Miasto B" };
    this._unit = "°";
  }

  connectedCallback() {
    this.render();
    this.addInteractivity();
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        this._width = entry.contentRect.width;
        this._height = entry.contentRect.height;
        this.updateChart();
      }
    });
    resizeObserver.observe(this);
  }

  set data(seriesData) {
    this._data = seriesData;
    this.updateChart();
  }

  set labels({ a, b }) {
    this._labels = { a, b };
  }

  set unit(u) {
    this._unit = u;
  }

  render() {
    const style = `
            :host { display: block; width: 100%; height: 100%; position: relative; cursor: crosshair; }
            svg { width: 100%; height: 100%; overflow: visible; cursor: crosshair; display: block; }
            svg * { pointer-events: none; }
            .axis-line { stroke: var(--grid-line, #1e2430); stroke-width: 1; }
            .axis-text { fill: var(--text-secondary); font-family: 'JetBrains Mono', monospace; font-size: 11px; }

            path {
                fill: none;
                stroke-width: 2.5;
                transition: d 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
            }
            .line-a { stroke: var(--color-a); filter: drop-shadow(0 4px 6px rgba(34, 211, 238, 0.1)); }
            .line-b { stroke: var(--color-b); filter: drop-shadow(0 4px 6px rgba(245, 158, 11, 0.1)); }
            
            .crosshair { stroke: rgba(255,255,255,0.2); stroke-width: 1; stroke-dasharray: 4; opacity: 0; pointer-events: none; }
            .hover-dot { fill: var(--bg-card); stroke-width: 2; r: 4; opacity: 0; pointer-events: none; }
            .dot-a { stroke: var(--color-a); }
            .dot-b { stroke: var(--color-b); }

            .tooltip {
                position: fixed;
                top: 0; left: 0;
                background: rgba(19, 22, 27, 0.95);
                border: 1px solid var(--border-subtle, #1f232d);
                padding: 12px;
                border-radius: 4px;
                font-family: 'JetBrains Mono', monospace;
                font-size: 12px;
                color: var(--text-primary);
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.1s;
                z-index: 9999;
                box-shadow: 0 10px 20px rgba(0,0,0,0.5);
                white-space: nowrap;
            }
            .tt-row { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
            .tt-time { border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; margin-bottom: 4px; }
            .tt-val { font-weight: bold; margin-left: auto; }
            .tt-dot { width: 6px; height: 6px; border-radius: 50%; display: block; }
        `;

    this.shadowRoot.innerHTML = `
            <style>${style}</style>
            <div id="tooltip" class="tooltip"></div>
            <svg>
                <g id="grid"></g>
                <path class="line-a" d=""></path>
                <path class="line-b" d=""></path>
                <line id="crosshair" class="crosshair" x1="0" y1="0" x2="0" y2="100%"></line>
                <circle id="dot-a" class="hover-dot dot-a"></circle>
                <circle id="dot-b" class="hover-dot dot-b"></circle>
            </svg>
        `;
  }

  updateChart() {
    if (!this._data || !this._data.length) return;

    const MAX = 800;
    let pData = this._data;
    if (this._data.length > MAX) {
      const step = Math.ceil(this._data.length / MAX);
      pData = this._data.filter((_, i) => i % step === 0);
    }
    this._processedData = pData;

    const valsA = this._processedData.map((d) => d.valA);
    const valsB = this._processedData.map((d) => d.valB);

    const allVals = [...valsA, ...valsB].filter((v) => v !== null);
    if (!allVals.length) return;

    const rawMin = Math.min(...allVals);
    const rawMax = Math.max(...allVals);
    const rawRange = rawMax - rawMin;

    let step = 5;
    if (rawRange < 10) step = 1;
    else if (rawRange > 50) step = 10;
    else if (rawRange > 100) step = 25;

    this.min = Math.floor(rawMin / step) * step;
    let snappedMax = Math.ceil(rawMax / step) * step;
    if (snappedMax === this.min) snappedMax += step;
    this.max = snappedMax;
    this.range = this.max - this.min;

    this.drawGrid(step);
    const opts = { min: this.min, max: this.max };

    const TARGET_POINTS = 200;
    const hasB = valsB.some((v) => v !== null);
    const normA = this.normalizeData(valsA, TARGET_POINTS);
    const normB = hasB
      ? this.normalizeData(valsB, TARGET_POINTS)
      : Array(TARGET_POINTS).fill(null);

    const pathA = this.engine.generateSmoothPath(
      normA,
      this._width,
      this._height,
      this._padding,
      opts
    );
    this.shadowRoot.querySelector(".line-a").setAttribute("d", pathA);

    if (hasB) {
      const pathB = this.engine.generateSmoothPath(
        normB,
        this._width,
        this._height,
        this._padding,
        opts
      );
      this.shadowRoot.querySelector(".line-b").setAttribute("d", pathB);
      this.shadowRoot.querySelector(".line-b").style.display = "block";
    } else {
      this.shadowRoot.querySelector(".line-b").setAttribute("d", "");
      this.shadowRoot.querySelector(".line-b").style.display = "none";
    }
  }

  normalizeData(data, targetCount) {
    if (!data || data.length === 0) return Array(targetCount).fill(0);
    if (data.length === 1) return Array(targetCount).fill(data[0]);

    const result = [];
    const step = (data.length - 1) / (targetCount - 1);

    for (let i = 0; i < targetCount; i++) {
      const x = i * step;
      const idx = Math.floor(x);
      const t = x - idx;

      const v0 = data[idx] === null ? this.min || 0 : data[idx];
      const v1Idx = Math.min(idx + 1, data.length - 1);
      const v1 = data[v1Idx] === null ? this.min || 0 : data[v1Idx];

      result.push(v0 + (v1 - v0) * t);
    }
    return result;
  }

  drawGrid(step) {
    const g = this.shadowRoot.querySelector("#grid");
    g.innerHTML = "";

    const h = this._height;
    const p = this._padding;
    const drawH = h - p * 2;

    for (let t = this.min; t <= this.max; t += step) {
      const normY = (t - this.min) / this.range;
      const y = h - p - normY * drawH;

      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      line.setAttribute("x1", p);
      line.setAttribute("x2", this._width - p);
      line.setAttribute("y1", y);
      line.setAttribute("y2", y);
      line.setAttribute("class", "axis-line");
      g.appendChild(line);

      const text = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text"
      );
      text.setAttribute("x", p - 10);
      text.setAttribute("y", y + 4);
      text.setAttribute("text-anchor", "end");
      text.setAttribute("class", "axis-text");
      text.textContent = Math.round(t);
      g.appendChild(text);
    }
  }

  addInteractivity() {
    const svg = this.shadowRoot.querySelector("svg");
    const tooltip = this.shadowRoot.getElementById("tooltip");
    const crosshair = this.shadowRoot.getElementById("crosshair");
    const dotA = this.shadowRoot.getElementById("dot-a");
    const dotB = this.shadowRoot.getElementById("dot-b");

    this.addEventListener("mousemove", (e) => {
      if (!this._processedData || !this._width) return;
      const rect = this.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;

      const p = this._padding;
      const drawW = this._width - p * 2;
      const stepX = drawW / (this._processedData.length - 1);
      let index = Math.round((mouseX - p) / stepX);
      if (index < 0) index = 0;
      if (index >= this._processedData.length)
        index = this._processedData.length - 1;

      const point = this._processedData[index];
      const x = p + index * stepX;

      const coordY = (val) => {
        if (val === null) return -1000;
        const normY = (val - this.min) / this.range;
        return this._height - p - normY * (this._height - p * 2);
      };

      const yA = coordY(point.valA);
      const yB = coordY(point.valB);

      crosshair.style.opacity = 0.5;
      crosshair.setAttribute("x1", x);
      crosshair.setAttribute("x2", x);
      crosshair.setAttribute("y1", this._padding);
      crosshair.setAttribute("y2", this._height - this._padding);
      dotA.style.opacity = 1;
      dotA.setAttribute("cx", x);
      dotA.setAttribute("cy", yA);
      dotB.style.opacity = 1;
      dotB.setAttribute("cx", x);
      dotB.setAttribute("cy", yB);

      const date = new Date(point.timestamp);
      const dayName = date.toLocaleDateString("pl-PL", { weekday: "long" });
      const dayNum = date.getDate();
      const monthName = date.toLocaleDateString("pl-PL", { month: "long" });
      const time = date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      const capDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
      const capMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

      const finalDateString = `<span style="opacity:0.7">${capDay}, ${dayNum} ${capMonth}</span> <span style="opacity:0.4; margin:0 6px">•</span> <span style="color:#fff">${time}</span>`;

      tooltip.style.opacity = 1;

      let ttX = e.clientX + 20;
      let ttY = e.clientY + 20;

      if (ttX + 180 > window.innerWidth) {
        ttX = e.clientX - 190;
      }
      if (ttY + 100 > window.innerHeight) {
        ttY = e.clientY - 110;
      }

      // console.log(ttX, ttY);
      tooltip.style.transform = `translate(${ttX}px, ${ttY}px)`;

      tooltip.innerHTML = `
                <div class="tt-time">${finalDateString}</div>
                <div class="tt-row">
                    <span class="tt-dot" style="background:var(--color-a)"></span>
                    <span>${this._labels.a}</span>
                    <span class="tt-val">${point.valA}${this._unit}</span>
                </div>
                ${
                  point.valB !== null
                    ? `
                <div class="tt-row">
                    <span class="tt-dot" style="background:var(--color-b)"></span>
                    <span>${this._labels.b}</span>
                    <span class="tt-val">${point.valB}${this._unit}</span>
                </div>`
                    : ""
                }
            `;

      if (point.valB === null) dotB.style.opacity = 0;
    });

    this.addEventListener("mouseleave", () => {
      tooltip.style.opacity = 0;
      crosshair.style.opacity = 0;
      dotA.style.opacity = 0;
      dotB.style.opacity = 0;
    });
  }
}

customElements.define("sky-chart", SkyChart);
