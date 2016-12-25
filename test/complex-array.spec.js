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

  it('should update one item property by array index', function(done) {
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
          { id: 2, name: 'Shiva' },
          { id: 3, name: 'Milena' }
        ]
      });

      expect(state.allNames).to.equal('Shiva, Milena');

      done();
    });

    store.update({
      'people.2.name': 'Shiva'
    });
  });

  it('should update one item by array index with throw', function() {
    store.update({
      people: [
        { id: 2, name: 'Kitana' },
        { id: 3, name: 'Milena' }
      ]
    });

    var f = store.update.bind(store, {
      'people.1.name': 'Shiva'
    });
    
    expect(f).to.throw('cannot_update_nonexistent_item: people.1');
  });

  it('should update one item by array index throw', function(done) {
    store.update({
      people: [
        { id: 2, name: 'Kitana' },
        { id: 3, name: 'Milena' }
      ]
    });

    // store.removeItem('people', 2);
    //store.insertItem('people', { id: 2, name: 'Shiva' });
    // use remove + insert instead update of entire object
    var f = store.update.bind(store, {
      'people.3': {
        name: 'Shiva'
      }
    });

    expect(f).to.throw('update_is_not_supported_for_path: people.3 use removeItem + insertItem instead');
    done();
  });
});
