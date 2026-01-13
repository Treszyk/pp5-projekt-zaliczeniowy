import { MeteoClient } from '../api/meteoClient.js';

export class SingleCityView extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this.client = new MeteoClient();

		this._city = null;
		this._range = '7d';
		this._activeMetric = 'temp';

		this._cache = {};

		this._favorites =
			JSON.parse(localStorage.getItem('weather_favorites')) || [];
	}

	connectedCallback() {
		this.render();
		this.bindEvents();
		this.renderFavorites();
	}

	toggleFavorite() {
		if (!this._city) return;

		const idx = this._favorites.findIndex((f) => f.name === this._city.name);
		if (idx >= 0) {
			this._favorites.splice(idx, 1);
		} else {
			this._favorites.push(this._city);
		}

		localStorage.setItem('weather_favorites', JSON.stringify(this._favorites));
		this.updateFavIcon();
		this.renderFavorites();
	}

	updateFavIcon() {
		const btn = this.shadowRoot.getElementById('fav-btn');
		if (!this._city || !btn) return;

		const isFav = this._favorites.some((f) => f.name === this._city.name);
		btn.style.color = isFav ? '#f59e0b' : '#64748b';
		btn.textContent = isFav ? '★' : '☆';
	}

	renderFavorites() {
		const container = this.shadowRoot.getElementById('fav-list');
		if (!container) return;
		container.innerHTML = '';

		this._favorites.forEach((city) => {
			const chip = document.createElement('div');
			chip.className = 'fav-chip';
			const subtext =
				city.country ||
				`${city.latitude.toFixed(2)}, ${city.longitude.toFixed(2)}`;

			chip.innerHTML = `
                <span class="icon">★</span>
                <span class="text">
                    <span class="main">${city.name}</span>
                    <span class="details">${subtext}</span>
                </span>
            `;
			chip.onclick = () => {
				const input = this.shadowRoot.getElementById('city-input');
				if (input) input.value = city.name;
				this.fetchCityData(city);
			};
			container.appendChild(chip);
		});
	}

	async fetchCityData(city) {
		this._city = city;
		this.updateFavIcon();
		this.renderStatsPlaceholder(true);

		try {
			const rangeSelect = this.shadowRoot.getElementById('range-select');
			const modeBtn = this.shadowRoot.querySelector('.mode-btn.active');
			const mode = modeBtn ? modeBtn.dataset.mode : 'forecast';
			const days = rangeSelect ? rangeSelect.value : 7;

			const lat = city.latitude;
			const lon = city.longitude;

			const fetchMetric = async (metric) => {
				const daysInt = parseInt(days);
				let res;

				if (mode === 'history') {
					const end = new Date();
					end.setDate(end.getDate() - 1);
					const start = new Date();
					start.setDate(end.getDate() - daysInt);
					const fmt = (d) => d.toISOString().split('T')[0];
					res = await this.client.fetchHistory(
						lat,
						lon,
						metric,
						fmt(start),
						fmt(end)
					);
				} else {
					res = await this.client.fetchForecast(lat, lon, metric, daysInt);
				}

				if (!res || !res.hourly) return null;
				return {
					timestamps: res.hourly.time,
					timeSeries: res.hourly[metric],
				};
			};

			const [temp, wind, hum, rain] = await Promise.all([
				fetchMetric('temperature_2m'),
				fetchMetric('windspeed_10m'),
				fetchMetric('relativehumidity_2m'),
				fetchMetric('precipitation'),
			]);

			this._cache = { temp, wind, hum, rain };

			this.updateDashboard();
		} catch (e) {
			console.error(e);
		}
	}

	updateDashboard() {
		if (!this._cache.temp) return;

		this.updateCard('temp', this._cache.temp);
		this.updateCard('wind', this._cache.wind, 'km/h');
		this.updateCard('hum', this._cache.hum, '%');
		this.updateCard('rain', this._cache.rain, 'mm');

		this.updateChart();
	}

	updateCard(type, data, unitSuffix = '°') {
		const avg = (
			data.timeSeries.reduce((a, b) => a + b, 0) / data.timeSeries.length
		).toFixed(1);
		const cardVal = this.shadowRoot.querySelector(`#val-${type}`);
		if (cardVal) cardVal.textContent = `${avg}${unitSuffix}`;

		const card = this.shadowRoot.querySelector(`#card-${type}`);
		if (type === this._activeMetric) card.classList.add('active');
		else card.classList.remove('active');
	}

	updateChart() {
		const dataSet = this._cache[this._activeMetric];
		if (!dataSet) return;

		const chart = this.shadowRoot.querySelector('sky-chart');

		const series = dataSet.timeSeries.map((val, i) => ({
			timestamp: dataSet.timestamps[i],
			valA: val,
			valB: null,
		}));

		chart.labels = { a: this._city.name, b: '' };

		let unit = '°';
		if (this._activeMetric === 'wind') unit = ' km/h';
		if (this._activeMetric === 'hum') unit = '%';
		if (this._activeMetric === 'rain') unit = ' mm';
		chart.unit = unit;

		chart.data = series;
	}

	renderStatsPlaceholder(isLoading = false) {
		const vals = this.shadowRoot.querySelectorAll('.stat-val');
		vals.forEach((v) => (v.textContent = isLoading ? '...' : '--'));
	}

	render() {
		const style = `
             :host { display: block; font-family: 'Inter', sans-serif; animation: slideIn 0.4s ease; }
             @keyframes slideIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }

            			.control-bar {
				display: grid;
				grid-template-columns: 1.5fr 1fr 1fr 0.5fr;
				gap: 1rem;
				background: #13161b;
				padding: 1rem;
				border: 1px solid #1f232d;
				border-radius: 4px 4px 0 0;
				align-items: end;
				margin-bottom: 0;
			}
			.input-group { display: flex; flex-direction: column; gap: 0.5rem; position: relative; }
			label { font-size: 0.75rem; color: #64748b; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; }

			input, select {
				background: transparent;
				border: none;
				border-bottom: 2px solid #1f232d;
				color: white;
				font-size: 0.95rem;
				padding: 0.5rem 0;
				font-family: 'Inter', sans-serif;
				transition: border-color 0.2s;
				width: 100%;
			}
			select option { color: white; background: #13161b; }
			input:focus, select:focus { border-color: #38bdf8; }

            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
            .stat-card {
                background: #13161b; border: 1px solid #1f232d; padding: 1.5rem; border-radius: 4px; cursor: pointer; transition: all 0.2s;
                position: relative; overflow: hidden;
            }
            .stat-card:hover { border-color: #64748b; transform: translateY(-2px); }
            .stat-card.active { border-color: var(--color-a); box-shadow: 0 4px 12px rgba(34, 211, 238, 0.1); }
            .stat-card.active::after { content:''; position:absolute; top:0; left:0; width:100%; height:3px; background:var(--color-a); }
            
            .stat-label { font-size: 0.8rem; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem; }
            .stat-val { font-size: 1.8rem; font-weight: 500; color: #e2e8f0; font-family: 'JetBrains Mono'; }
            
            .chart-box {
                background: #13161b; border: 1px solid #1f232d; border-radius: 4px; padding: 1rem; height: 500px; position: relative;
            }

			.suggestions { position: absolute; top: 100%; left: 0; right: 0; background: #0b0c0f; border: 1px solid #1f232d; border-radius: 4px; z-index: 1000; max-height: 200px; overflow-y: auto; display: none; }
			.suggestions.show { display: block; }
			.suggestion-item { padding: 10px; cursor: pointer; color: #94a3b8; font-size: 0.9rem; border-bottom: 1px solid #13161b; }
			.suggestion-item:hover { background: #1f232d; color: #fff; }

			.mode-switch { display:flex; gap: 5px; }
			.mode-btn { 
				background: transparent; border: 1px solid #334155; color: #64748b; 
				padding: 6px 12px; cursor: pointer; font-family: 'Inter'; font-size: 0.85rem; border-radius: 4px; 
				transition: all 0.2s; flex: 1; text-align: center;
			}
			.mode-btn.active { background: rgba(56, 189, 248, 0.1); border-color: #38bdf8; color: #e2e8f0; }
			.mode-btn:hover:not(.active) { border-color: #94a3b8; color: #cbd5e1; }

            .fav-wrap {
                background: #0f1115;
                border: 1px solid #1f232d;
                border-top: none;
                border-radius: 0 0 4px 4px;
                padding: 0.8rem 1rem;
                display: flex;
                gap: 0.8rem;
                overflow-x: auto;
                white-space: nowrap;
                margin-bottom: 2rem;
            }
            .fav-wrap::-webkit-scrollbar { height: 6px; }
            .fav-wrap::-webkit-scrollbar-track { background: #13161b; }
            .fav-wrap::-webkit-scrollbar-thumb { background: #1f232d; border-radius: 3px; }

            .fav-chip {
                flex-shrink: 0;
                background: rgba(30, 41, 59, 0.4);
                border: 1px solid #334155;
                color: #94a3b8;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 10px;
                min-width: 120px;
            }
            .fav-chip:hover {
                border-color: #f59e0b;
                background: rgba(245, 158, 11, 0.1);
                color: #e2e8f0;
            }
            .fav-chip .icon { font-size: 1.2rem; color: #f59e0b; }
            .fav-chip .text { display: flex; flex-direction: column; line-height: 1.2; text-align: left; }
            .fav-chip .main { font-size: 0.85rem; font-weight: 500; color: #e2e8f0; }
            .fav-chip .details { font-size: 0.7rem; color: #64748b; font-family: 'JetBrains Mono', monospace; }
        `;

		this.shadowRoot.innerHTML = `
            <style>${style}</style>
            
            <div class="control-bar">
                <div class="input-group">
					<label>Miasto</label>
                    <input type="text" id="city-input" placeholder="Wpisz miasto..." autocomplete="off" />
                    <div id="suggestions" class="suggestions"></div>
                </div>

                <div class="input-group">
					<label>Tryb</label>
					<div class="mode-switch">
						<button class="mode-btn active" data-mode="forecast">Prog. (dni)</button>
						<button class="mode-btn" data-mode="history">Historia</button>
					</div>
                </div>

                <div class="input-group">
					<label>Zakres</label>
					<select id="range-select">
						<option value="3">3 Dni</option>
						<option value="7" selected>7 Dni</option>
						<option value="14">14 Dni</option>
					</select>
                </div>
                
                <div class="input-group" style="align-items:center; justify-content:center;">
					<label style="opacity:0">Fav</label>
	                <button id="fav-btn" style="background:transparent; border:none; color:#64748b; cursor:pointer; font-size:1.5rem; transition:color 0.2s; line-height:1;" title="Zapisz">☆</button>
				</div>
            </div>
            
            <div id="fav-list" class="fav-wrap"></div>

            <div class="grid">
                <div class="stat-card active" id="card-temp" data-type="temp">
                    <div class="stat-label">Temperatura (Śr)</div>
                    <div class="stat-val" id="val-temp">--</div>
                </div>
                <div class="stat-card" id="card-wind" data-type="wind">
                    <div class="stat-label">Wiatr</div>
                    <div class="stat-val" id="val-wind">--</div>
                </div>
                <div class="stat-card" id="card-hum" data-type="hum">
                    <div class="stat-label">Wilgotność</div>
                    <div class="stat-val" id="val-hum">--</div>
                </div>
                <div class="stat-card" id="card-rain" data-type="rain">
                    <div class="stat-label">Opady</div>
                    <div class="stat-val" id="val-rain">--</div>
                </div>
            </div>

            <div class="chart-box">
                <sky-chart></sky-chart>
            </div>
        `;
	}

	bindEvents() {
		const rangeSelect = this.shadowRoot.getElementById('range-select');
		const input = this.shadowRoot.getElementById('city-input');
		const list = this.shadowRoot.getElementById('suggestions');
		const modeBtns = this.shadowRoot.querySelectorAll('.mode-btn');

		let currentMode = 'forecast';

		const updateOptions = () => {
			rangeSelect.innerHTML = '';
			const opts =
				currentMode === 'forecast'
					? [
							{ v: 3, l: '3 Dni' },
							{ v: 7, l: '7 Dni' },
							{ v: 14, l: '14 Dni' },
					  ]
					: [
							{ v: 14, l: '14 Dni (Min)' },
							{ v: 30, l: '30 Dni' },
							{ v: 90, l: '3 Miesiące' },
							{ v: 365, l: '1 Rok' },
					  ];

			opts.forEach((o) => {
				const opt = document.createElement('option');
				opt.value = o.v;
				opt.textContent = o.l;
				rangeSelect.appendChild(opt);
			});
			rangeSelect.value = opts[1].v;
		};

		modeBtns.forEach((btn) => {
			btn.addEventListener('click', () => {
				modeBtns.forEach((b) => b.classList.remove('active'));
				btn.classList.add('active');
				currentMode = btn.dataset.mode;
				updateOptions();
				if (this._city) this.fetchCityData(this._city);
			});
		});

		const favBtn = this.shadowRoot.getElementById('fav-btn');
		if (favBtn) favBtn.addEventListener('click', () => this.toggleFavorite());

		let timer;

		input.addEventListener('input', (e) => {
			const val = e.target.value;
			clearTimeout(timer);
			if (val.length < 2) {
				list.classList.remove('show');
				return;
			}

			timer = setTimeout(async () => {
				const results = await this.client.searchCity(val);
				list.innerHTML = '';
				if (results && results.length) {
					results.slice(0, 5).forEach((city) => {
						const div = document.createElement('div');
						div.className = 'suggestion-item';
						div.textContent = `${city.name} (${city.country})`;
						div.onclick = () => {
							input.value = city.name;
							list.classList.remove('show');
							this.fetchCityData(city);
						};
						list.appendChild(div);
					});
					list.classList.add('show');
				}
			}, 300);
		});

		rangeSelect.addEventListener('change', () => {
			if (this._city) this.fetchCityData(this._city);
		});

		const cards = this.shadowRoot.querySelectorAll('.stat-card');
		cards.forEach((card) => {
			card.addEventListener('click', () => {
				this._activeMetric = card.dataset.type;
				this.updateDashboard();
			});
		});
	}
}

customElements.define('single-city-view', SingleCityView);
