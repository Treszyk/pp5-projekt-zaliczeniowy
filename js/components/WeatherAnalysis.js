export class WeatherAnalysis extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
	}

	set data({ series, cityA, cityB, metricName }) {
		this.render(series, cityA, cityB, metricName);
	}

	calculateStats(series) {
		const calculateAvg = (key) => {
			const sum = series.reduce((acc, curr) => acc + (curr[key] || 0), 0);
			return (sum / series.length).toFixed(1);
		};

		const maxA = Math.max(...series.map((d) => d.valA));
		const maxB = Math.max(...series.map((d) => d.valB));

		const aWins = series.filter((d) => d.valA > d.valB).length;
		const bWins = series.length - aWins;
		const winPrc = Math.round((aWins / series.length) * 100);

		return {
			avgA: calculateAvg('valA'),
			avgB: calculateAvg('valB'),
			maxA,
			maxB,
			winPrc,
		};
	}

	render(series, cityA, cityB, metricName) {
		if (!series || !series.length) return;
		const stats = this.calculateStats(series);
		const totalWins = stats.winPrc;
		const diff = (stats.avgA - stats.avgB).toFixed(1);
		const diffPrc = (((stats.avgA - stats.avgB) / stats.avgB) * 100).toFixed(0);
		const isAPositive = diff > 0;

		const style = `
            :host { display: block; margin-top: 1.5rem; font-family: 'Inter', sans-serif; }
            .grid {
                display: grid;
                grid-template-columns: 2fr 1fr;
                gap: 1.5rem;
            }
            .card {
                background: #13161b;
                border: 1px solid #1f232d;
                border-radius: 4px;
                padding: 1.5rem;
                display: flex; flex-direction: column; gap: 1rem;
            }
            h3 { margin: 0; font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 1px; font-family: 'JetBrains Mono'; }
            
            .tug-of-war {
                height: 12px;
                width: 100%;
                background: #1e293b;
                border-radius: 6px;
                overflow: hidden;
                display: flex;
                margin: 1rem 0;
            }
            .bar-a { height: 100%; background: var(--color-a); transition: width 1s ease; }
            .bar-b { height: 100%; background: var(--color-b); transition: width 1s ease; }

            .stat-row { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #1f232d; padding-bottom: 8px; }
            .stat-row:last-child { border-bottom: none; }
            .label { font-size: 0.9rem; color: #94a3b8; }
            .val { font-size: 1.1rem; font-weight: 600; font-family: 'JetBrains Mono'; color: #e2e8f0; }
            .delta { font-size: 0.8rem; padding: 2px 6px; border-radius: 2px; }
            .pos { color: #4ade80; background: rgba(74, 222, 128, 0.1); }
            .neg { color: #f87171; background: rgba(248, 113, 113, 0.1); }

            .verdict-box { text-align: center; display: flex; flex-direction: column; justify-content: center; height: 100%; }
            .winner-name { font-size: 1.5rem; font-weight: 700; color: #e2e8f0; margin-bottom: 0.5rem; }
            .winner-desc { font-size: 0.85rem; color: #64748b; line-height: 1.4; }

            @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } }
        `;

		this.shadowRoot.innerHTML = `
            <style>${style}</style>
            <div class="grid">
                <div class="card">
                    <h3>Analiza Porównawcza</h3>
                    
                    <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#64748b; margin-bottom:4px;">
                        <span style="color:var(--color-a)">${cityA} (${totalWins}%)</span>
                        <span style="color:var(--color-b)">${cityB} (${
			100 - totalWins
		}%)</span>
                    </div>
                    <div class="tug-of-war">
                        <div class="bar-a" style="width: ${totalWins}%"></div>
                        <div class="bar-b" style="width: ${
													100 - totalWins
												}%"></div>
                    </div>

                    <div class="stat-row">
                        <span class="label">Średnia Różnica</span>
                        <div>
                             <span class="delta ${isAPositive ? 'pos' : 'neg'}">
                                ${isAPositive ? '+' : ''}${diff}
                             </span>
                        </div>
                    </div>
                    <div class="stat-row">
                        <span class="label">Maksimum (${cityA})</span>
                        <span class="val">${stats.maxA}</span>
                    </div>
                    <div class="stat-row">
                        <span class="label">Maksimum (${cityB})</span>
                        <span class="val">${stats.maxB}</span>
                    </div>
                </div>

                <div class="card">
                    <h3>Werdykt</h3>
                    <div class="verdict-box">
                        <div class="winner-name" style="color: ${
													totalWins > 50 ? 'var(--color-a)' : 'var(--color-b)'
												}">
                            ${totalWins > 50 ? cityA : cityB}
                        </div>
                        <div class="winner-desc">
                            Dominuje w tej kategorii.<br>
                            Wygrywa w <strong>${
															totalWins > 50 ? totalWins : 100 - totalWins
														}%</strong> pomiarów w wybranym okresie.
                        </div>
                    </div>
                </div>
            </div>
        `;
	}
}

customElements.define('weather-analysis', WeatherAnalysis);
