/**
 * A city - it is an entity (limited entity with few parameters)
 * A weather/temperature - it is just a parameter (not an entity)
 *
 * City
 * - id
 * - name
 *
 * CityWeatherState
 * - id = city_id + date
 * - city_id
 * - date
 * - temperature
 * - pressure
 */

module.exports = {
  cityId: { type: 'Text' },
  date: { type: 'Date' },
  temperature: {
    type: 'Integer',
    computedAsync: ['cityId', 'date', function(cityId, date, resolve) { // reject
      if (cityId === null || date === null) { return null; }
      console.log('run async weather');
      // update externally
      var timeoutInstance = setTimeout(function() {
        resolve(42);
        // reject('error message or code');
      }, 500);

      return clearTimeout.bind(null, timeoutInstance);
    }]
  },
  temperatureMessage: {
    type: 'Text',
    computed: ['temperature', function(prom) {
      if (prom === null || prom.data === null) { return null; }
      return 'The weather is ' + prom.data;
    }]
  }
};
