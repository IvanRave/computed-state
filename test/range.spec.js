var expect = require('chai').expect;
var State = require('../src/computed-state');
var range = require('./range');

describe('store', function() {
  var state;
  beforeEach(function() {
    state = new State(range);
  });

  afterEach(function() { state = null; });

  it('should update start end', function(done) {
    state.subscribe(function(changedKeys, state) {
      expect(changedKeys).to.deep.equal([
        'start', 'end', 'duration'
      ]);

      expect(state.start).to.equal(15);
      expect(state.end).to.equal(24);
      expect(state.duration).to.equal(9);
      done();
    });

    state.update({ start: 15, end: 24 });
  });
});
