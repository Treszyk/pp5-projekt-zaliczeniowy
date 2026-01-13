import { MeteoClient } from './api/meteoClient.js';
import './components/SkyChart.js';
import './components/CitySearch.js';
import './components/WeatherAnalysis.js';
import './components/SingleCityView.js';

const TOP_CITIES = {
	Warszawa: { lat: 52.2297, lon: 21.0122 },
	Londyn: { lat: 51.5074, lon: -0.1278 },
	'Nowy Jork': { lat: 40.7128, lon: -74.006 },
	Tokio: { lat: 35.6762, lon: 139.6503 },
	Berlin: { lat: 52.52, lon: 13.405 },
	Paryż: { lat: 48.8566, lon: 2.3522 },
};

class App {
	constructor() {
		this.api = new MeteoClient();
		this.chart = document.querySelector('sky-chart#chart-compare');
		this.analysis = document.querySelector('weather-analysis');
		this.search = document.querySelector('city-search');
		this.init();
	}

	init() {
		const btnCompare = document.getElementById('nav-compare');
		const btnSingle = document.getElementById('nav-single');
		const btnReset = document.getElementById('btn-reset');
		const viewCompare = document.getElementById('view-compare');
		const viewSingle = document.getElementById('view-single');

		const switchView = (toSingle) => {
			if (isAnimating) return;
			isAnimating = true;

			const current = toSingle ? viewCompare : viewSingle;
			const next = toSingle ? viewSingle : viewCompare;

			if (toSingle) {
				btnSingle.classList.add('active');
				btnCompare.classList.remove('active');
			} else {
				btnCompare.classList.add('active');
				btnSingle.classList.remove('active');
			}

			current.classList.add('fade-out');

			setTimeout(() => {
				current.style.display = 'none';
				current.classList.remove('fade-out');

				next.style.display = 'flex';
				next.classList.add('fade-in');

				setTimeout(() => {
					next.classList.remove('fade-in');
					isAnimating = false;
				}, 400);
			}, 300);
		};

		let isAnimating = false;

		if (btnCompare && btnSingle) {
			btnCompare.addEventListener('click', () => switchView(false));
			btnSingle.addEventListener('click', () => switchView(true));
		}

		if (btnReset) {
			const modal = document.getElementById('confirm-modal');
			const btnCancel = document.getElementById('modal-cancel');
			const btnConfirm = document.getElementById('modal-confirm');

			btnReset.addEventListener('click', () => {
				modal.classList.add('show');
			});

			btnCancel.addEventListener('click', () => {
				modal.classList.remove('show');
			});

			btnConfirm.addEventListener('click', () => {
				localStorage.removeItem('climate_prefs');
				localStorage.removeItem('climate_history');
				localStorage.removeItem('weather_favorites');
				window.location.reload();
			});

			modal.addEventListener('click', (e) => {
				if (e.target === modal) modal.classList.remove('show');
			});
		}

		document.body.addEventListener('compare-trigger', async (e) => {
			const params = e.detail;
			this.saveState(params);
			await this.loadComparison(params);
		});

		this.restoreState();
	}

	saveState(params) {
		try {
			const state = {
				cityA: params.cityA,
				cityB: params.cityB,
				metric: params.metric,
				days: params.days,
				mode: params.mode,
			};
			localStorage.setItem('climate_prefs', JSON.stringify(state));
		} catch (e) {}
	}

	restoreState() {
		const saved = localStorage.getItem('climate_prefs');
		if (saved) {
			try {
				const s = JSON.parse(saved);
				this.search.setValues(s.cityA, s.cityB, s.metric, s.days, s.mode);
				return;
			} catch (e) {}
		}
		this.loadComparison({
			cityA: 'Warszawa',
			cityB: 'Londyn',
			metric: 'temperature_2m',
			days: 7,
			mode: 'future',
			metricName: 'Temperatura (°C)',
		});
	}

	updateAmbient(metric) {
		document.body.classList.remove(
			'dataset-temp',
			'dataset-rain',
			'dataset-air',
			'dataset-wind'
		);

		if (metric.includes('temp')) document.body.classList.add('dataset-temp');
		else if (metric.includes('precip'))
			document.body.classList.add('dataset-rain');
		else if (metric.includes('wind'))
			document.body.classList.add('dataset-wind');
		else if (metric.includes('pm')) document.body.classList.add('dataset-air');
	}

	async resolveCity(name) {
		if (TOP_CITIES[name]) return TOP_CITIES[name];
		try {
			const res = await fetch(
				`https://geocoding-api.open-meteo.com/v1/search?name=${name}&count=1`
			);
			const data = await res.json();
			if (data.results && data.results.length) {
				return {
					lat: data.results[0].latitude,
					lon: data.results[0].longitude,
				};
			}
		} catch (e) {
			console.error(e);
		}
		return null;
	}

	getUnit(metric) {
		if (metric.includes('temp')) return '°';
		if (metric.includes('wind')) return ' km/h';
		if (metric.includes('humid')) return '%';
		if (metric.includes('precip')) return ' mm';
		if (metric.includes('pm')) return ' µg/m³';
		return '';
	}

	async loadComparison({ cityA, cityB, metric, days, mode, metricName }) {
		try {
			const modeLabel = mode === 'past' ? '(Historia)' : '(Prognoza)';

			this.updateAmbient(metric);

			document.querySelector(
				'.legend-a'
			).innerHTML = `<div class="legend-color"></div> ${cityA} <small>${modeLabel}</small>`;
			document.querySelector(
				'.legend-b'
			).innerHTML = `<div class="legend-color"></div> ${cityB} <small>${modeLabel}</small>`;

			this.chart.labels = { a: cityA, b: cityB };
			this.chart.unit = this.getUnit(metric);

			const coordsA = await this.resolveCity(cityA);
			const coordsB = await this.resolveCity(cityB);

			if (!coordsA || !coordsB) return;

			const data = await this.api.getComparison(
				coordsA,
				coordsB,
				metric,
				days,
				mode
			);
			this.chart.data = data;

			if (this.analysis) {
				this.analysis.data = { series: data, cityA, cityB, metricName };
			}
		} catch (err) {
			console.error(err);
		}
	}
}

new App();
