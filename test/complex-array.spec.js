var expect = require('chai').expect;
var ComputedState = require('../src/computed-state');
var complexArray = require('./complex-array');

describe('store', function() {
  var store;
  beforeEach(function() {
    store = new ComputedState(complexArray);
  });

  afterEach(function() { store = null; });

  it('should update name', function(done) {
    expect(store.state.people).to.deep.equal([]);

    store.subscribe(function(changedKeys, state) {
      expect(changedKeys).to.deep.equal([
        'people', 'allNames'
      ]);

      expect(state.people).to.deep.equal([
        { id: 1, name: 'Kitana', isValid: true },
        { id: 2, name: 'Che', isValid: false }
      ]);

      done();
    });

    store.update({ people: [
      { id: 1, name: 'Kitana' },
      { id: 2, name: 'Che' }
    ] });
  });

  it('should insert', function(done) {
    store.insertItem('people', { id: 2, name: 'Kitana' });

    store.subscribe(function(changedKeys, state, writableState) {
      expect(changedKeys).to.deep.equal([
        'people', 'allNames'
      ]);

      expect(writableState).to.deep.equal({
        people: [
          { id: 2, name: 'Kitana' },
          { id: 3, name: 'Milena' }
        ]
      });

      expect(state.allNames).to.equal('Kitana, Milena');

      done();
    });

    store.insertItem('people', { id: 3, name: 'Milena' });
  });

  it('should remove', function(done) {
    store.update({
      people: [
        { id: 2, name: 'Kitana' },
        { id: 3, name: 'Milena' }
      ]
    });

    store.subscribe(function(changedKeys, state, writableState) {
      expect(changedKeys).to.deep.equal([
        'people', 'allNames'
      ]);

      expect(writableState).to.deep.equal({
        people: [
          { id: 2, name: 'Kitana' }
        ]
      });

      expect(state.allNames).to.equal('Kitana');

      done();
    });

    store.removeItem('people', 3);
  });
});
