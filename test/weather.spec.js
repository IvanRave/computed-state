var expect = require('chai').expect;
var ComputedState = require('../src/computed-state');
var weather = require('./weather');

describe('weather', function() {
  var store;
  beforeEach(function() {
    store = new ComputedState(weather);
  });

  afterEach(function() { store = null; });

  it('should', function(done) {
    // http://stackoverflow.com/questions/25537808/make-mocha-wait-before-running-next-test
    this.timeout(5000);

    // two messages:
    // 1. with null weather
    // 2. with fullfilled weather
    // TODO: change to removable array instead subNumber
    var subNumber = 1;

    store.subscribe(function(changedKeys, state) {
      // after: update({ endpoint: 'fresh' })
      if (subNumber === 1) {
        expect(changedKeys).to.deep.equal([
          'endpoint', 'weather'
        ]);

        expect(state.weather).to.deep.equal({
          data: null,
          error: null,
          loading: true
        });
        
        expect(state.weatherMessage).to.null;

        subNumber += 1;
        return;
      }

      // after: update({ 'weather.data': 32 })
      if (subNumber === 2) {
        expect(changedKeys).to.deep.equal([
          'weather', 'weatherMessage'
        ]);

        expect(state.weather).to.deep.equal({
          data: 32,
          error: null,
          loading: false
        });

        expect(state.weatherMessage).to.equal('The weather is 32');
        return;
      }

      throw new Error('no such subNumber');
    });

    store.subscribeAsync(function(changedAsyncKeys, state) {
      expect(changedAsyncKeys).to.deep.equal(['weather']);
      expect(state.weather).to.deep.equal({
        data: 32, error: null, loading: false
      });
      done();
    });

    store.update({ endpoint: 'https://news.yandex.ru/index.rss' });
  });
});
