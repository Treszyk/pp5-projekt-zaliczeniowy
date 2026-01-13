export class WeatherStats extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
	}

	connectedCallback() {
		this.render();
	}

	set data(climateData) {
		this._data = climateData;
		this.calculateStats();
	}

	calculateStats() {
		if (!this._data || this._data.length === 0) return;

		const current = this._data[0];
		const currentTemp = current.currentTemp;

		const currentTemps = this._data
			.map((d) => d.currentTemp)
			.filter((n) => n !== null);
		const pastTemps = this._data
			.map((d) => d.pastTemp)
			.filter((n) => n !== null);

		const avgCurr = (
			currentTemps.reduce((a, b) => a + b, 0) / currentTemps.length
		).toFixed(1);
		const avgPast = (
			pastTemps.reduce((a, b) => a + b, 0) / pastTemps.length
		).toFixed(1);

		const diff = (avgCurr - avgPast).toFixed(1);
		const sign = diff > 0 ? '+' : '';
		const verdict = diff > 0 ? 'Warmer' : 'Cooler';
		const color = diff > 0 ? 'var(--secondary)' : 'var(--primary)';

		this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; margin-top: 1rem; }
                .stat-box {
                    font-family: 'Inter', sans-serif;
                    padding: 1rem;
                    background: rgba(255,255,255,0.03);
                    border-radius: 12px;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                h2 { margin: 0 0 1rem 0; font-size: 1.1rem; color: #94a3b8; font-weight: 500; }
                .big-number {
                    font-size: 3.5rem;
                    font-weight: 800;
                    margin: 0;
                    background: linear-gradient(to bottom, #fff, #94a3b8);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    font-family: 'Outfit', sans-serif;
                }
                .label { font-size: 0.9rem; color: #94a3b8; }
                
                .comparison {
                    margin-top: 1.5rem;
                    padding-top: 1rem;
                    border-top: 1px solid rgba(255,255,255,0.1);
                }
                .verdict {
                    font-size: 1.2rem;
                    font-weight: bold;
                    color: ${color};
                }
                .sub-text { font-size: 0.85rem; color: #64748b; margin-top: 0.2rem; }
            </style>
            
            <div class="stat-box">
                <h2>Current Conditions</h2>
                <div class="big-number">${currentTemp}°</div>
                <div class="label">Feels like.. whatever</div>
                
                <div class="comparison">
                    <div class="label">vs. Last Year</div>
                    <div class="verdict">${sign}${diff}°C ${verdict}</div>
                    <div class="sub-text">Average weekly temperature deviation</div>
                </div>
            </div>
        `;
	}

	render() {
		this.shadowRoot.innerHTML = `<div style="padding:1rem; color:#666">Loading stats...</div>`;
	}
}

customElements.define('weather-stats', WeatherStats);
