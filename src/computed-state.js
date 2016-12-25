/** @module */

'use strict';

const Listener = require('./listener');
const Computer = require('./computer');

const toPlainChangedKeys = function(scope, target) {
  if (!scope) { throw new Error('toPlainChangedKeys_scope_required'); }

  if (Array.isArray(scope) === true) {
    scope.forEach(function(item) {
      toPlainChangedKeys(item, target);
    });
  } else {
    // if Object
    Object.keys(scope).forEach(function(key) {
      if (target.indexOf(key) < 0) { target.push(key); }
      toPlainChangedKeys(scope[key], target);
    });
  }
};

// get with cloning
const getWritableProperties = function(obj) {
  if (Array.isArray(obj)) {
    return obj.map(function(item) {
      return getWritableProperties(item);
    });
  }

  const result = {};

  Object.keys(obj).forEach(function(key) {
    if (!obj.__config[key].computed) {
      const value = obj[key];
      if (value !== null && typeof value === 'object') {
        // objects
        result[key] = getWritableProperties(value);
      } else {
        // primitives
        result[key] = obj[key];
      }
    }
  });

  return result;
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
    // console.log('scopeOfChangedKeys', JSON.stringify(scopeOfChangedKeys));
    const allChangedKeys = [];
    toPlainChangedKeys(scopeOfChangedKeys, allChangedKeys);
    this.ready(allChangedKeys);
  }

  /** Copy an return a current state */
  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * @returns {Object} Scope of writable properties (without computed)
   *  e.g: to backup it
   */
  getWritableState() {
    return getWritableProperties(this.state);
  }

  ready(changedKeys) {
    const state = this.getState();
    const writableState = this.getWritableState();

    this.listeners.forEach(function(listener) {
      listener.notify(changedKeys, state, writableState);
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
