var expect = require('chai').expect;
var State = require('../src/computed-state');
var complex = require('./complex');

var personJane = {
  identifier: 'Jane',
  name: 'Jane'
};

var personJohn = {
  identifier: 'John',
  name: 'John'
};

var someGroup = {
  identifier: '5A',
  name: 'BestGroup',
  members: [{
    identifier: 30,
    level: 30,
    person: personJane
  }, {
    identifier: 70,
    level: 70,
    person: personJohn
  }],
  // data duplicate (foreign_key in rdbms)
  captain: {
    identifier: 70,
    level: 70,
    person: personJohn
  }
};

describe('store', function() {
  var store;
  beforeEach(function() {
    store = new State(complex, 'identifier');
    store.update({
      groups: [someGroup],
      persons: [personJane, personJohn]
    });
  });

  afterEach(function() {
    store = null;
  });

  it('should update name', function(done) {
    store.subscribe(function(changedKeys, state) {
      expect(changedKeys).to.deep.equal(['groups']);
      expect(state.groups[0].name).to.equal('SuperGroup');
      done();
    });

    var upd = {};
    upd['groups.5A.name'] = 'SuperGroup';
    store.update(upd);
  });

  it('should insert group', function(done) {
    store.subscribe(function(changedKeys, state) {
      expect(changedKeys).to.deep.equal(['groups']);

      expect(state.groups.length).to.equal(2);
      done();
    });

    store.insertItem('groups', {
      identifier: '5B',
      name: 'MiddleGroup'
    });
  });

  it('should remove group', function(done) {
    store.insertItem('groups', {
      identifier: '5B',
      name: 'MiddleGroup'
    });

    store.subscribe(function(changedKeys, state) {
      expect(changedKeys).to.deep.equal(['groups']);

      expect(state.groups.length).to.equal(1);
      expect(state.groups[0].name).to.equal('MiddleGroup');
      done();
    });

    store.removeItem('groups', '5A');
  });

  it('should insert member to group', function(done) {
    store.subscribe(function(changedKeys, state) {
      expect(changedKeys).to.deep.equal(['groups']);

      expect(state.groups.length).to.equal(1);
      expect(state.groups[0].members.length).to.equal(3);
      expect(state.groups[0].members[2].identifier).to.equal(12345);
      expect(state.groups[0].members[2].cid).to.equal('c12345');
      // person is required
      expect(state.groups[0].members[2].person).to.deep.equal({
        identifier: 'Jill',
        name: 'Jill',
        cname: 'cJill',
        birthDate: null
      });
      done();
    });

    store.insertItem('groups.5A.members', {
      identifier: 12345,
      created: '2010-01-01',
      person: {
        identifier: 'Jill',
        name: 'Jill'
      }
    });
  });

  it('should remove member from a group', function(done) {
    store.subscribe(function(changedKeys, state) {
      expect(changedKeys).to.deep.equal(['groups']);

      expect(state.groups.length).to.equal(1);
      expect(state.groups[0].members.length).to.equal(1);
      expect(state.groups[0].members[0].identifier).to.equal(70);
      expect(state.groups[0].members[0].cid).to.equal('c70');
      expect(state.groups[0].members[0].person).to.deep.equal({
        identifier: 'John',
        birthDate: null,
        cname: 'cJohn',
        name: 'John'
      });

      done();
    });

    store.removeItem('groups.5A.members', 30);
  });
});
