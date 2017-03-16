var expect = require('chai').expect;
var State = require('../src/computed-state');
var modelTemplate = require('./event-fixed');

describe('store', function() {
  var store;
  beforeEach(function() {
    store = new State(modelTemplate);
  });

  afterEach(function() { store = null; });

  it('should update start', function(done) {
    store.update({ durationFixed: 'P7D' });

    store.subscribe(function(changedKeys, state) {
      expect(changedKeys).to.deep.equal([
        'startDate', 'endDateFixed'
      ]);

      expect(state.startDate).to.equal('2010-05-08');
      expect(state.endDate).to.null;
      expect(state.duration).to.null;
      expect(state.durationFixed).to.equal('P7D');
      expect(state.endDateFixed).to.equal('2010-05-15');
      done();
    });

    store.update({ startDate: '2010-05-08' });
  });
});
