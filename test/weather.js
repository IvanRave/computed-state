module.exports = {
  endpoint: { type: String },
  weather: {
    type: Number,
    computedAsync: ['endpoint', function(endpoint, resolve, reject) {
      if (endpoint === null) { return null; }
      console.log('run async weather');
      // update externally
      var timeoutInstance = setTimeout(function() {
        // console.log('resolve 35');
        resolve(endpoint.length);
        // reject('error message or code');
      }, 500);

      return clearTimeout.bind(null, timeoutInstance);
    }]
  },
  weatherMessage: {
    type: String,
    computed: ['weather', function(prom) {
      if (prom === null || prom.data === null) { return null; }
      return 'The weather is ' + prom.data;
    }]
  }
};
