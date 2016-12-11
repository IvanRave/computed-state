/** @module */

var Listener = require('./listener');
var Computer = require('./computer');

var toPlainChangedKeys = function(scope, total) {
  if (!scope) { throw new Error('toPlainChangedKeys_scope_required'); }

  if (Array.isArray(scope) === true) {
    scope.forEach(function(item) {
      toPlainChangedKeys(item, total);
    });
  } else {
    // if Object
    Object.keys(scope).forEach(function(key) {
      if (total.indexOf(key) < 0) { total.push(key); }
      toPlainChangedKeys(scope[key], total);
    });
  }
};

class ComputedState {
  constructor(rootConfig) {
    this.state = new Computer(rootConfig);
    this.listeners = [];
  }
  operate(scopeOfChangedKeys) {
    if (!scopeOfChangedKeys || scopeOfChangedKeys.length === 0) {
      return;
    }

    var allChangedKeys = [];
    toPlainChangedKeys(scopeOfChangedKeys, allChangedKeys);
    this.ready(allChangedKeys);
  }

  /** Copy an return a current state */
  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  ready(changedKeys) {
    var state = this.getState();

    this.listeners.forEach(function(listener) {
      listener.notify(changedKeys, state);
    });
  }

  update(props) {
    this.operate(this.state.update(props));
  }
  insertItem(propName, item) {
    this.operate(this.state.insertItem(propName, item));
  }
  removeItem(propName, id) {
    this.operate(this.state.removeItem(propName, id));
  }

  pingState() {
    this.ready([]);
  }

  subscribe(callback, watchedKeys) {
    this.listeners.push(new Listener(callback, watchedKeys));
  }
}

module.exports = ComputedState;
