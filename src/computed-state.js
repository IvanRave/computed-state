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
    if (!obj.__config[key].calculate) {
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

/**
 * @returns {*} Scope of async paths and functions
 * 'student': asyncFunction
 * 'student.rating': asyncFunction
 * etc.
 */
const getAsyncPaths = function(obj) {
  if (Array.isArray(obj)) {
    return obj.map(function(item) {
      return getAsyncPaths(item);
    });
  }

  const result = {};

  Object.keys(obj).forEach(function(key) {
    var keyConfig = obj.__config[key];
    var calculateAsync = keyConfig.calculateAsync;
    var watchedKeys = keyConfig.watchedKeys;

    // if async exists
    if (!calculateAsync || !watchedKeys) { return; }

    var asyncWatchedValues = watchedKeys.map(function(watchedKey) {
      return obj[watchedKey];
    });

    result[key] = {
      propertyPath: key,
      func: calculateAsync,
      args: asyncWatchedValues
    };

    // TODO: inner properties with paths
  });

  return result;
};

class ComputedState {
  constructor(rootConfig) {
    this.state = new Computer(rootConfig);
    this.listeners = [];
    this.asyncListeners = [];

    /**
     * Timeouts, XHR requests and other async instances
     * To cancel it before new invocation
     */
    this.asyncCancels = {};
  }

  /** Convert changed keys; notify listeners; run async handlers */
  operate(scopeOfChangedKeys, skippedPropertyKey) {
    if (!scopeOfChangedKeys || scopeOfChangedKeys.length === 0) {
      return;
    }
    // console.log('scopeOfChangedKeys', JSON.stringify(scopeOfChangedKeys));
    // TODO: convert to changed paths instead keys (or add to output)
    const allChangedKeys = [];
    toPlainChangedKeys(scopeOfChangedKeys, allChangedKeys);
    this.ready(allChangedKeys);

    // remove skipped items
    var neededChangedKeys = allChangedKeys.filter(function(key) {
      return key !== skippedPropertyKey;
    });

    if (neededChangedKeys.length > 0) {
      this.handleAsyncProps(neededChangedKeys);
    }
  }

  /**
   * When the entire state is stabilized - run async operations:
   * - get all async properties and functions
   * - run it for changed paths (keys for this moment)
   */
  handleAsyncProps(allChangedPaths) {
    const asyncPaths = getAsyncPaths(this.state);

    var that = this;

    // Array of { func: func, args: args }
    var changedAsyncPaths = [];

    // TODO: if not yet fullfilled
    // if (obj[key].data !== null) { return; }

    Object.keys(asyncPaths).forEach(function(propertyPath) {
      if (allChangedPaths.indexOf(propertyPath) < 0) { return; }
      var obj = asyncPaths[propertyPath];
      changedAsyncPaths.push(obj);
    });


    var maxAsyncCalls = changedAsyncPaths.length;
    var changedAsyncKeys = changedAsyncPaths.map(function(item) {
      return item.propertyPath;
    });

    changedAsyncPaths.forEach(function(asyncScope) {
      const asyncFunction = asyncScope.func;
      const asyncArgs = asyncScope.args;
      const propertyPath = asyncScope.propertyPath;

      // console.log('async', propertyPath);

      var finish = function(propertyValue) {
        // console.log('update...', propertyPath, propertyValue);
        that._updateAsyncProperty(propertyPath, propertyValue);
        // console.log('updated', propertyPath);

        maxAsyncCalls -= 1;
        if (maxAsyncCalls === 0) {
          that.readyAsync(changedAsyncKeys);
        }
      };

      var resolve = function(val) {
        finish({
          data: val,
          error: null,
          loading: false
        });
      };

      var reject = function(err) {
        finish({
          data: null,
          error: err,
          loading: false
        });
      };

      // Returns a Timeout for use with clearTimeout()
      var allArgs = asyncArgs.concat([resolve, reject]);

      // clean prev timeout
      var prevCancelAsync = that.asyncCancels[propertyPath];
      if (prevCancelAsync) {
        prevCancelAsync();
        delete that.asyncCancels[propertyPath];
      }

      // run computedAsync function
      var cancelAsync = asyncFunction.apply(null, allArgs);
      that.asyncCancels[propertyPath] = cancelAsync;
    });
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
    const writableState = getWritableProperties(this.state);
    // console.log('w', writableState);
    return writableState;
  }

  update(props) {
    this.operate(this.state.update(props));
  }

  /** Update all properties, but skip re-async for async props */
  _updateAsyncProperty(propertyPath, propertyValue) {
    var upd = {};
    upd[propertyPath] = propertyValue;
    this.operate(this.state.update(upd), propertyPath);
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

  subscribeAsync(callback, watchedKeys) {
    this.asyncListeners.push(new Listener(callback, watchedKeys));
  }

  /** When all sync operations are finished */
  ready(changedKeys) {
    const state = this.getState();
    const writableState = this.getWritableState();

    this.listeners.forEach(function(listener) {
      listener.notify(changedKeys, state, writableState);
    });
  }

  /** When all async operations are finished */
  readyAsync(changedAsyncKeys) {
    const state = this.getState();
    const writableState = this.getWritableState();

    this.asyncListeners.forEach(function(listener) {
      listener.notify(changedAsyncKeys, state, writableState);
    });
  }
}

module.exports = ComputedState;
