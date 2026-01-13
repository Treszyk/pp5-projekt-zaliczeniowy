import { MeteoClient } from '../api/meteoClient.js';

export class CitySearch extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this.cityA = 'Warszawa';
		this.cityB = 'Londyn';
		this.history = [];
		this.debounceTimer = null;
		this.client = new MeteoClient();
	}

	connectedCallback() {
		this.loadHistory();
		this.render();
		this.renderHistory();
		this.bindEvents();
		this.updateRangeOptions();
	}

	loadHistory() {
		try {
			const h = localStorage.getItem('climate_history');
			if (h) this.history = JSON.parse(h);
		} catch (e) {}
	}

	saveHistory(paramObj) {
		const days = this.shadowRoot.querySelector('#days').value;
		const item = {
			a: paramObj.cityA,
			b: paramObj.cityB,
			m: paramObj.metric,
			mode: paramObj.mode,
			d: days,
		};

		this.history = this.history.filter(
			(x) => !(x.a === item.a && x.b === item.b)
		);

		this.history.unshift(item);
		if (this.history.length > 10) this.history.pop();

		localStorage.setItem('climate_history', JSON.stringify(this.history));
		this.renderHistory();
	}

	setValues(a, b, metric, days, mode) {
		if (a) this.shadowRoot.getElementById('in-a').value = a;
		if (b) this.shadowRoot.getElementById('in-b').value = b;
		if (metric) this.shadowRoot.getElementById('metric').value = metric;
		if (mode) {
			const modeSel = this.shadowRoot.getElementById('mode');
			modeSel.value = mode;
			this.updateRangeOptions();
		}
		if (days) this.shadowRoot.getElementById('days').value = days;

		this.cityA = a;
		this.cityB = b;
		this.handleInput(0);
	}

	handleInput(delay) {
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		const action = () => {
			this.triggerUpdate();
		};
		if (delay === 0) action();
		else this.debounceTimer = setTimeout(action, delay);
	}

	triggerUpdate() {
		const iA = this.shadowRoot.getElementById('in-a');
		const iB = this.shadowRoot.getElementById('in-b');
		if (!iA || !iB) return;

		this.cityA = iA.value;
		this.cityB = iB.value;
		const metric = this.shadowRoot.querySelector('#metric').value;
		const days = this.shadowRoot.querySelector('#days').value;
		const mode = this.shadowRoot.querySelector('#mode').value;
		const metricName = this.shadowRoot.querySelector(
			'#metric option:checked'
		).text;

		if (!this.cityA || !this.cityB) return;

		this.saveHistory({ cityA: this.cityA, cityB: this.cityB, metric, mode });

		this.dispatchEvent(
			new CustomEvent('compare-trigger', {
				detail: {
					cityA: this.cityA,
					cityB: this.cityB,
					metric,
					days,
					mode,
					metricName,
				},
				bubbles: true,
				composed: true,
			})
		);
	}

	updateRangeOptions() {
		const mode = this.shadowRoot.getElementById('mode').value;
		const daysSel = this.shadowRoot.getElementById('days');
		const currentVal = daysSel.value;

		let options = [];
		if (mode === 'future') {
			options = [
				{ val: '1', text: '24h' },
				{ val: '3', text: '3 Dni' },
				{ val: '7', text: '7 Dni' },
				{ val: '14', text: '14 Dni' },
			];
		} else {
			options = [
				{ val: '7', text: 'Tydzień' },
				{ val: '30', text: 'Miesiąc' },
				{ val: '90', text: 'Kwartał' },
				{ val: '365', text: 'Rok' },
			];
		}

		daysSel.innerHTML = options
			.map((o) => `<option value="${o.val}">${o.text}</option>`)
			.join('');
		if (options.find((o) => o.val === currentVal)) daysSel.value = currentVal;
		else daysSel.value = options[0].val;
	}

	bindEvents() {
		const setupAutocomplete = (inputId, listId) => {
			const input = this.shadowRoot.getElementById(inputId);
			const list = this.shadowRoot.getElementById(listId);
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
								this.handleInput(0);
							};
							list.appendChild(div);
						});
						list.classList.add('show');
					}
				}, 300);
			});

			input.addEventListener('blur', () => {
				setTimeout(() => list.classList.remove('show'), 200);
			});
		};

		setupAutocomplete('in-a', 'list-a');
		setupAutocomplete('in-b', 'list-b');

		const selects = this.shadowRoot.querySelectorAll('select');

		const modeSel = this.shadowRoot.getElementById('mode');
		modeSel.addEventListener('change', () => {
			this.updateRangeOptions();
			this.handleInput(0);
		});

		const otherSelects = Array.from(selects).filter((s) => s.id !== 'mode');
		otherSelects.forEach((el) =>
			el.addEventListener('change', () => this.handleInput(0))
		);
		this.shadowRoot
			.querySelector('form')
			.addEventListener('submit', (e) => e.preventDefault());
	}

	getMetricIcon(m) {
		if (m.includes('temp')) return '🌡️';
		if (m.includes('wind')) return '💨';
		if (m.includes('humid')) return '💧';
		if (m.includes('precip')) return '🌧️';
		if (m.includes('pm')) return '🌫️';
		return '📊';
	}

	formatDays(d) {
		if (d >= 365) return 'Rok';
		if (d >= 30) return `${Math.floor(d / 30)} mc`;
		return `${d}d`;
	}

	renderHistory() {
		const container = this.shadowRoot.getElementById('history-container');
		if (!container) return;
		container.innerHTML = '';
		this.history.forEach((h) => {
			const btn = document.createElement('button');
			btn.className = 'hist-chip';
			btn.title = `${h.a} vs ${h.b}`;
			btn.innerHTML = `
                <span class="icon">${this.getMetricIcon(h.m)}</span>
                <span class="text">
                    <span class="main">${h.a} / ${h.b}</span>
                    <span class="details">${this.formatDays(h.d)} ${
				h.mode === 'past' ? 'Hist.' : 'Prog.'
			}</span>
                </span>
             `;
			btn.addEventListener('click', () => {
				this.setValues(h.a, h.b, h.m, h.d, h.mode);
			});
			container.appendChild(btn);
		});
	}

	render() {
		const style = `
            :host { display: block; }
            form { 
                display: grid; 
                grid-template-columns: 1.2fr 1.2fr 1fr 0.8fr 0.8fr; 
                gap: 1rem; 
                background: #13161b; 
                padding: 1rem;
                border: 1px solid #1f232d;
                border-radius: 4px 4px 0 0;
                align-items: end;
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
            .lbl-a { color: var(--color-a); }
            .lbl-b { color: var(--color-b); }

            .suggestions { position: absolute; top: 100%; left: 0; right: 0; background: #0b0c0f; border: 1px solid #1f232d; border-radius: 4px; z-index: 100; max-height: 200px; overflow-y: auto; display: none; }
            .suggestions.show { display: block; }
            .suggestion-item { padding: 10px; cursor: pointer; color: #94a3b8; font-size: 0.9rem; border-bottom: 1px solid #13161b; }
            .suggestion-item:hover { background: #1f232d; color: #fff; }

            .history-wrap {
                background: #0f1115;
                border: 1px solid #1f232d;
                border-top: none;
                border-radius: 0 0 4px 4px;
                padding: 0.8rem 1rem;
                display: flex;
                gap: 0.8rem;
                overflow-x: auto;
                white-space: nowrap;
            }
            
            .history-wrap::-webkit-scrollbar { height: 6px; }
            .history-wrap::-webkit-scrollbar-track { background: #13161b; }
            .history-wrap::-webkit-scrollbar-thumb { background: #1f232d; border-radius: 3px; }
            .history-wrap::-webkit-scrollbar-thumb:hover { background: #334155; }

            .hist-chip {
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
                min-width: 140px;
            }
            .hist-chip:hover {
                border-color: #38bdf8;
                background: rgba(56, 189, 248, 0.1);
                color: #e2e8f0;
            }
            .hist-chip .icon { font-size: 1.2rem; }
            .hist-chip .text { display: flex; flex-direction: column; line-height: 1.2; text-align: left; }
            .hist-chip .main { font-size: 0.85rem; font-weight: 500; color: #e2e8f0; }
            .hist-chip .details { font-size: 0.7rem; color: #64748b; font-family: 'JetBrains Mono', monospace; }

            @media (max-width: 768px) { form { grid-template-columns: 1fr; gap: 1.5rem; } }
        `;

		this.shadowRoot.innerHTML = `
            <style>${style}</style>
            <form>
                <div class="input-group">
                    <label class="lbl-a">Miasto A</label>
                    <input id="in-a" type="text" value="${this.cityA}" autocomplete="off" />
                    <div id="list-a" class="suggestions"></div>
                </div>
                <div class="input-group">
                    <label class="lbl-b">Miasto B</label>
                    <input id="in-b" type="text" value="${this.cityB}" autocomplete="off" />
                    <div id="list-b" class="suggestions"></div>
                </div>
                <div class="input-group">
                    <label>Dane</label>
                    <select id="metric">
                        <option value="temperature_2m">Temperatura</option>
                        <option value="windspeed_10m">Wiatr</option>
                        <option value="relativehumidity_2m">Wilgotność</option>
                        <option value="precipitation">Opady</option>
                        <option value="pm2_5">Jakość Powietrza (PM2.5)</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>Tryb</label>
                    <select id="mode">
                        <option value="future">Prognoza</option>
                        <option value="past">Historia</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>Zakres</label>
                    <select id="days"></select>
                </div>
            </form>
            <div id="history-container" class="history-wrap"></div>
        `;
	}
}
customElements.define('city-search', CitySearch);
