var expect = require('chai').expect;
var State = require('../src/computed-state');
var modelTemplate = require('./event');

describe('store', function() {
  var store;
  beforeEach(function() {
    store = new State(modelTemplate);
  });

  afterEach(function() { store = null; });

  it('should update start end', function(done) {
    store.subscribe(function(changedKeys, state) {
      expect(changedKeys).to.deep.equal([
        'startDate', 'endDate', 'duration'
      ]);

      expect(state.startDate).to.equal('2010-05-20');
      expect(state.endDate).to.equal('2010-08-15');
      expect(state.duration).to.equal('P2M26D');
      done();
    });

    store.update({ startDate: '2010-05-20', endDate: '2010-08-15' });
  });

  it('should return only writable properties', function() {
    var result = store.getWritableEntity();
    expect(result).to.deep.equal({
      name: null,
      startDate: null,
      endDate: null
    });
  });
});
