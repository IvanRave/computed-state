var expect = require('chai').expect;
var State = require('../src/computed-state');
var complex = require('./complex');

describe('store', function() {
  var state;
  beforeEach(function() {
    state = new State(complex);
  });

  afterEach(function() { state = null; });

  it('should update name', function(done) {
    state.subscribe(function(changedKeys, state) {
      expect(changedKeys).to.deep.equal([
        'name', 'isNameValid'
      ]);

      expect(state.name).to.equal('Kate');
      expect(state.isNameValid).to.true;
      done();
    });

    state.update({ name: 'Kate' });
  });

  it('should update ageRange', function(done) {
    state.subscribe(function(changedKeys, state) {
      expect(changedKeys).to.deep.equal([
        'ageRange', 'name', 'isNameValid', 'isValid'
      ]);

      expect(state.ageRange.start).to.equal(18);
      expect(state.isValid).to.equal(true);
      done();
    });

    state.update({
      ageRange: { start: 18, end: 120 },
      name: 'Kate'
    });
  });

  it('should update ageRange', function(done) {
    state.update({
      ageRange: { start: 18, end: 120 },
      name: 'Kate'
    });

    state.subscribe(function(changedKeys, state) {
      expect(changedKeys).to.deep.equal([
        'ageRange'
      ]);

      expect(state.ageRange.start).to.equal(16);
      done();
    });

    state.update({
      'ageRange.start': 16
    });
  });

  it('should return only writable properties', function() {
    state.update({ ageRange: { start: 18 }});

    var result = state.getWritableState();
    expect(result).to.deep.equal({
      ageRange: {
        start: 18,
        end: null
      },
      name: null
    });
  });
});
