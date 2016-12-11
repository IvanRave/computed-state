var expect = require('chai').expect;
var State = require('../src/computed-state');
var rangeFixed = require('./range-fixed');

describe('store', function() {
  var state;
  beforeEach(function() {
    state = new State(rangeFixed);
  });

  afterEach(function() { state = null; });

  it('should update start', function(done) {
    state.update({ durationFixed: 100 });

    state.subscribe(function(changedKeys, state) {
      expect(changedKeys).to.deep.equal([
        'start', 'endFixed'
      ]);

      expect(state.start).to.equal(15);
      expect(state.end).to.null;
      expect(state.duration).to.null;
      expect(state.durationFixed).to.equal(100);
      expect(state.endFixed).to.equal(115);
      done();
    });

    state.update({ start: 15 });
  });
});
