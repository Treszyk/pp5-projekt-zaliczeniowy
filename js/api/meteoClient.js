import Ajax from "../../js-lib/ajax-lib.js";
console.log(Ajax);

export class MeteoClient {
  constructor() {
    this.baseUrl = "https://api.open-meteo.com/v1";
    this.archiveUrl = "https://archive-api.open-meteo.com/v1";
    this.airUrl = "https://air-quality-api.open-meteo.com/v1";
    this.ajax = new Ajax();
  }

  async getComparison(
    coordsA,
    coordsB,
    metric = "temperature_2m",
    days = 7,
    mode = "future"
  ) {
    try {
      const fetchFn = (lat, lon) => {
        if (metric === "pm2_5") {
          return this.fetchAirQuality(lat, lon, days, mode);
        }

        if (mode === "past") {
          const end = new Date();
          end.setDate(end.getDate() - 1);
          const start = new Date();
          start.setDate(end.getDate() - parseInt(days));

          const fmt = (d) => d.toISOString().split("T")[0];
          return this.fetchHistory(lat, lon, metric, fmt(start), fmt(end));
        }

        return this.fetchForecast(lat, lon, metric, days);
      };

      const [resA, resB] = await Promise.all([
        fetchFn(coordsA.lat, coordsA.lon),
        fetchFn(coordsB.lat, coordsB.lon),
      ]);

      return this.mergeDatasets(resA, resB, metric);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async fetchForecast(lat, lon, metric, days) {
    const url = `${this.baseUrl}/forecast?latitude=${lat}&longitude=${lon}&hourly=${metric}&forecast_days=${days}&timezone=auto`;
    const res = await this.ajax.get(url);
    return res;
  }

  async fetchHistory(lat, lon, metric, start, end) {
    const url = `${this.archiveUrl}/archive?latitude=${lat}&longitude=${lon}&start_date=${start}&end_date=${end}&hourly=${metric}&timezone=auto`;
    const res = await this.ajax.get(url);
    return res;
  }

  async fetchAirQuality(lat, lon, days, mode) {
    let url = `${this.airUrl}/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm2_5&timezone=auto`;

    const end = new Date();
    const start = new Date();

    if (mode === "past") {
      end.setDate(end.getDate() - 1);
      start.setDate(end.getDate() - parseInt(days));
    } else {
      const safeDays = Math.min(parseInt(days), 5);
      end.setDate(start.getDate() + safeDays);
    }

    const fmt = (d) => d.toISOString().split("T")[0];
    url += `&start_date=${fmt(start)}&end_date=${fmt(end)}`;

    const res = await this.ajax.get(url);
    return res;
  }

  mergeDatasets(dataA, dataB, metric) {
    if (!dataA.hourly || !dataB.hourly) return [];

    const times = dataA.hourly.time;
    const valsA = this.cleanData(dataA.hourly[metric]);
    const valsB = this.cleanData(dataB.hourly[metric]);

    return times.map((time, index) => {
      return {
        timestamp: time,
        valA: valsA[index],
        valB: valsB[index],
      };
    });
  }

  cleanData(arr) {
    if (!arr) return [];
    let lastValid = 0;
    for (let v of arr) {
      if (v !== null && v !== undefined) {
        lastValid = v;
        break;
      }
    }
    return arr.map((v) => {
      if (v === null || v === undefined) return lastValid;
      lastValid = v;
      return v;
    });
  }

  async searchCity(query) {
    if (!query) return [];
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        query
      )}&count=5&language=pl`;
      const data = await this.ajax.get(url);
      return data.results || [];
    } catch (e) {
      console.error("Search failed", e);
      return [];
    }
  }
}
