/** @module */

'use strict';

const Listener = require('./listener');
const Computer = require('./computer');
const Setting = require('./setting');

const toPlainChangedPaths = function(scope, target) {
  if (!scope) { throw new Error('toPlainChangedPaths_scope_required'); }

  if (Array.isArray(scope) === true) {
    scope.forEach(function(item) {
      toPlainChangedPaths(item, target);
    });
  } else {
    Object.keys(scope).forEach(function(key) {
      if (target.indexOf(key) < 0) { target.push(key); }
      toPlainChangedPaths(scope[key], target);
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
    if (!obj.__settings[key].calculate) {
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
    var propSetting = obj.__settings[key];
    var calculateAsync = propSetting.calculateAsync;
    var watchedKeys = propSetting.watchedKeys;

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

/**
 * @param {Function} callback Executed when keys are changed
 * @param {String[]} watchedKeys List of property keys
 * @todo watchedPaths instead keys
 * @param {Listener[]} anyListeners List of async or usual listeners
 * @returns {Function} unsubscribe - remove subscription
 */
const subscribeAny = function(callback, watchedKeys, anyListeners) {
  const listener = new Listener(callback, watchedKeys);
  anyListeners.push(listener);
  return function() {
    const index = anyListeners.indexOf(listener);
    anyListeners.splice(index, 1);
  };
};

/**
 * Build settings from config
 * config is more readable; settings - usable
 * @param {Object} config { name: {type:'Text'}, ... }
 * @returns {Object} Scope of instances of settings
 */
const buildSettings = function(config) {
  const settings = {};
  Object.keys(config).forEach(function(propName) {
    settings[propName] = new Setting(propName, config[propName]);
  });

  return settings;
};

/**
 * @param {Object} rootEntityConfig A template for root entity
 * @param {String?} initialPrimaryKey A name of primary property,
 *         like 'id' or 'identifier'. One name for all entities.
 *         By default: 'id'
 * @returns An instance of ComputedState
 */
class ComputedState {
  constructor(rootEntityConfig, initialPrimaryKey) {
    const primaryKey = initialPrimaryKey || 'id';

    const rootSettings = buildSettings(rootEntityConfig);

    this._rootEntity = new Computer(rootSettings, primaryKey);
    this._listeners = [];
    this._asyncListeners = [];

    /**
     * Timeouts, XHR requests and other async instances
     * To cancel it before new invocation
     */
    this._asyncCancels = {};
  }

  /** Convert changed keys; notify listeners; run async handlers */
  operate(scopeOfChangedKeys, skippedPropertyKey) {
    if (!scopeOfChangedKeys || scopeOfChangedKeys.length === 0) {
      return;
    }
    // console.log('scopeOfChangedKeys', JSON.stringify(scopeOfChangedKeys));
    // TODO: convert to changed paths instead keys (or add to output)
    const allChangedPaths = [];
    toPlainChangedPaths(scopeOfChangedKeys, allChangedPaths);
    this.ready(allChangedPaths);

    // remove skipped items
    const neededChangedPaths = allChangedPaths.filter(function(key) {
      return key !== skippedPropertyKey;
    });

    if (neededChangedPaths.length > 0) {
      this.handleAsyncProps(neededChangedPaths);
    }
  }

  /**
   * When the entire state is stabilized - run async operations:
   * - get all async properties and functions
   * - run it for changed paths (keys for this moment)
   */
  handleAsyncProps(allChangedPaths) {
    const asyncPaths = getAsyncPaths(this._rootEntity);

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
      var prevCancelAsync = that._asyncCancels[propertyPath];
      if (prevCancelAsync) {
        prevCancelAsync();
        delete that._asyncCancels[propertyPath];
      }

      // run computedAsync function
      var cancelAsync = asyncFunction.apply(null, allArgs);
      that._asyncCancels[propertyPath] = cancelAsync;
    });
  }

  /** Copy an return a current state */
  getEntity() {
    return this._rootEntity;
    // TODO: or copy
    // return JSON.parse(JSON.stringify(this._rootEntity));
  }

  /**
   * @returns {Object} Scope of writable properties (without computed)
   *  e.g: to backup it
   */
  getWritableEntity() {
    const writableEntity = getWritableProperties(this._rootEntity);
    // console.log('w', writableState);
    return writableEntity;
  }

  update(paths) {
    this.operate(this._rootEntity.update(paths));
  }

  /** Update all properties, but skip re-async for async props */
  _updateAsyncProperty(propertyPath, propertyValue) {
    var upd = {};
    upd[propertyPath] = propertyValue;
    this.operate(this._rootEntity.update(upd), propertyPath);
  }

  insertItem(propertyPath, item) {
    this.operate(this._rootEntity.insertItem(propertyPath, item));
  }

  removeItem(propertyPath, primaryKeyValue) {
    this.operate(this._rootEntity.removeItem(propertyPath, primaryKeyValue));
  }

  subscribe(callback, watchedKeys) {
    return subscribeAny(callback, watchedKeys, this._listeners);
  }

  subscribeAsync(callback, watchedKeys) {
    return subscribeAny(callback, watchedKeys, this._asyncListeners);
  }

  /** When all sync operations are finished */
  ready(changedKeys) {
    const state = this.getEntity();
    const writableState = this.getWritableEntity();

    this._listeners.forEach(function(listener) {
      listener.notify(changedKeys, state, writableState);
    });
  }

  /** When all async operations are finished */
  readyAsync(changedAsyncKeys) {
    const state = this.getEntity();
    const writableState = this.getWritableEntity();

    this._asyncListeners.forEach(function(listener) {
      listener.notify(changedAsyncKeys, state, writableState);
    });
  }
}

module.exports = ComputedState;
