(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/** @module */

'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Listener = require('./listener');
var Computer = require('./computer');

var toPlainChangedKeys = function (scope, target) {
  if (!scope) {
    throw new Error('toPlainChangedKeys_scope_required');
  }

  if (Array.isArray(scope) === true) {
    scope.forEach(function (item) {
      toPlainChangedKeys(item, target);
    });
  } else {
    // if Object
    Object.keys(scope).forEach(function (key) {
      if (target.indexOf(key) < 0) {
        target.push(key);
      }
      toPlainChangedKeys(scope[key], target);
    });
  }
};

// get with cloning
var getWritableProperties = function (obj) {
  if (Array.isArray(obj)) {
    return obj.map(function (item) {
      return getWritableProperties(item);
    });
  }

  var result = {};

  Object.keys(obj).forEach(function (key) {
    if (!obj.__config[key].calculate) {
      var value = obj[key];
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
var getAsyncPaths = function (obj) {
  if (Array.isArray(obj)) {
    return obj.map(function (item) {
      return getAsyncPaths(item);
    });
  }

  var result = {};

  Object.keys(obj).forEach(function (key) {
    var keyConfig = obj.__config[key];
    var calculateAsync = keyConfig.calculateAsync;
    var watchedKeys = keyConfig.watchedKeys;

    // if async exists
    if (!calculateAsync || !watchedKeys) {
      return;
    }

    var asyncWatchedValues = watchedKeys.map(function (watchedKey) {
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

var ComputedState = function () {
  function ComputedState(rootConfig) {
    _classCallCheck(this, ComputedState);

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


  _createClass(ComputedState, [{
    key: 'operate',
    value: function operate(scopeOfChangedKeys, skippedPropertyKey) {
      if (!scopeOfChangedKeys || scopeOfChangedKeys.length === 0) {
        return;
      }
      // console.log('scopeOfChangedKeys', JSON.stringify(scopeOfChangedKeys));
      // TODO: convert to changed paths instead keys (or add to output)
      var allChangedKeys = [];
      toPlainChangedKeys(scopeOfChangedKeys, allChangedKeys);
      this.ready(allChangedKeys);

      // remove skipped items
      var neededChangedKeys = allChangedKeys.filter(function (key) {
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

  }, {
    key: 'handleAsyncProps',
    value: function handleAsyncProps(allChangedPaths) {
      var asyncPaths = getAsyncPaths(this.state);

      var that = this;

      // Array of { func: func, args: args }
      var changedAsyncPaths = [];

      // TODO: if not yet fullfilled
      // if (obj[key].data !== null) { return; }

      Object.keys(asyncPaths).forEach(function (propertyPath) {
        if (allChangedPaths.indexOf(propertyPath) < 0) {
          return;
        }
        var obj = asyncPaths[propertyPath];
        changedAsyncPaths.push(obj);
      });

      var maxAsyncCalls = changedAsyncPaths.length;
      var changedAsyncKeys = changedAsyncPaths.map(function (item) {
        return item.propertyPath;
      });

      changedAsyncPaths.forEach(function (asyncScope) {
        var asyncFunction = asyncScope.func;
        var asyncArgs = asyncScope.args;
        var propertyPath = asyncScope.propertyPath;

        // console.log('async', propertyPath);

        var finish = function (propertyValue) {
          // console.log('update...', propertyPath, propertyValue);
          that._updateAsyncProperty(propertyPath, propertyValue);
          // console.log('updated', propertyPath);

          maxAsyncCalls -= 1;
          if (maxAsyncCalls === 0) {
            that.readyAsync(changedAsyncKeys);
          }
        };

        var resolve = function (val) {
          finish({
            data: val,
            error: null,
            loading: false
          });
        };

        var reject = function (err) {
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

  }, {
    key: 'getState',
    value: function getState() {
      return JSON.parse(JSON.stringify(this.state));
    }

    /**
     * @returns {Object} Scope of writable properties (without computed)
     *  e.g: to backup it
     */

  }, {
    key: 'getWritableState',
    value: function getWritableState() {
      var writableState = getWritableProperties(this.state);
      // console.log('w', writableState);
      return writableState;
    }
  }, {
    key: 'update',
    value: function update(props) {
      this.operate(this.state.update(props));
    }

    /** Update all properties, but skip re-async for async props */

  }, {
    key: '_updateAsyncProperty',
    value: function _updateAsyncProperty(propertyPath, propertyValue) {
      var upd = {};
      upd[propertyPath] = propertyValue;
      this.operate(this.state.update(upd), propertyPath);
    }
  }, {
    key: 'insertItem',
    value: function insertItem(propName, item) {
      this.operate(this.state.insertItem(propName, item));
    }
  }, {
    key: 'removeItem',
    value: function removeItem(propName, id) {
      this.operate(this.state.removeItem(propName, id));
    }
  }, {
    key: 'pingState',
    value: function pingState() {
      this.ready([]);
    }
  }, {
    key: 'subscribe',
    value: function subscribe(callback, watchedKeys) {
      this.listeners.push(new Listener(callback, watchedKeys));
    }
  }, {
    key: 'subscribeAsync',
    value: function subscribeAsync(callback, watchedKeys) {
      this.asyncListeners.push(new Listener(callback, watchedKeys));
    }

    /** When all sync operations are finished */

  }, {
    key: 'ready',
    value: function ready(changedKeys) {
      var state = this.getState();
      var writableState = this.getWritableState();

      this.listeners.forEach(function (listener) {
        listener.notify(changedKeys, state, writableState);
      });
    }

    /** When all async operations are finished */

  }, {
    key: 'readyAsync',
    value: function readyAsync(changedAsyncKeys) {
      var state = this.getState();
      var writableState = this.getWritableState();

      this.asyncListeners.forEach(function (listener) {
        listener.notify(changedAsyncKeys, state, writableState);
      });
    }
  }]);

  return ComputedState;
}();

module.exports = ComputedState;

},{"./computer":2,"./listener":4}],2:[function(require,module,exports){
/** @module */

'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Effect = require('./effect');
var Setting = require('./setting');

var PRIMARY_KEY = 'id';

var findIndexByPrimaryKey = function (list, primaryKey) {
  for (var i = 0, l = list.length; i < l; i += 1) {
    if (list[i][PRIMARY_KEY] === primaryKey) {
      return i;
    }
  }
  return -1;
};

var hasOwnProperty = function (inst, propName) {
  return {}.hasOwnProperty.call(inst, propName);
};

var extendConfig = function (config) {
  var result = {};
  Object.keys(config).forEach(function (propName) {
    result[propName] = new Setting(propName, config[propName]);
  });
  return result;
};

/** A class to create calculated objects from specific configuration */

var Computer = function () {
  /**
   * @param {Object} config Common config for all instances
   */
  function Computer(config, initialProps) {
    _classCallCheck(this, Computer);

    Object.defineProperty(this, '__effects', {
      value: [],
      writable: false,
      enumerable: false,
      configurable: false
    });

    Object.defineProperty(this, '__config', {
      value: extendConfig(config),
      writable: false,
      enumerable: false,
      configurable: false
    });

    Object.keys(this.__config).forEach(this._createProperty.bind(this));

    if (initialProps) {
      this.update(initialProps);
    }
  }

  /**
   * Default values for properties:
   * - for primitives and nested objects: null
   * - for arrays: [] (can not be null)
   */


  _createClass(Computer, [{
    key: '_createProperty',
    value: function _createProperty(propName) {
      var propSettings = this.__config[propName];

      Object.defineProperty(this, propName, {
        value: Array.isArray(propSettings.type) ? [] : null,
        writable: true,
        enumerable: true,
        configurable: false
      });

      if (propSettings.calculate) {
        this._attachComputedProps(propName, propSettings.watchedKeys, propSettings.calculate);
      }
    }
  }, {
    key: '_attachComputedProps',
    value: function _attachComputedProps(propName, watchedKeys, calculate) {
      watchedKeys.forEach(this._verifyWatchedKey.bind(this));

      this.__effects.push(new Effect(this, propName, watchedKeys, calculate));
    }

    /** Wached properties must be declared before computed properties */

  }, {
    key: '_verifyWatchedKey',
    value: function _verifyWatchedKey(watchedKey) {
      if (!watchedKey || hasOwnProperty(this, watchedKey) === false) {
        throw new Error('required_dependent_property: ' + watchedKey);
      }
    }
  }, {
    key: '_createByType',
    value: function _createByType(PropConfigType, value) {
      // if String, Number, Boolean - just return the value
      if (value.constructor === PropConfigType) {
        return value;
      }

      // if own config type, like 'range', 'phone'
      //   return a computed instance of own type
      if (typeof PropConfigType === 'object') {
        // console.log('object', this.constructor);
        // console.log('new object, based', value);
        return new this.constructor(PropConfigType, value);
      }

      throw new TypeError('required_type: ' + PropConfigType + ' for value: ' + value);
    }

    /**
     * For example, create Instance from array
     * 'ranges': [{start: 123, end: 234}, {...}, ...]
     * Must return Array of instances for Arrays
     * @param {String} propName Like 'ranges', 'name'
     * @param {Array<Object>|String|Number|*} value Any value for this property
     * @returns {Object} Instance, based on this value
     */

  }, {
    key: '_createInstanceFromValue',
    value: function _createInstanceFromValue(propName, value) {
      if (value === null) {
        return null;
      }
      var settingType = this.__config[propName].type;
      var PropConfigType = Array.isArray(settingType) ? settingType[0] : settingType;

      var that = this;
      if (Array.isArray(value)) {
        return value.map(function (itemValue) {
          return that._createByType(PropConfigType, itemValue);
        });
      }

      return this._createByType(PropConfigType, value);
    }
  }, {
    key: '_set',
    value: function _set(key, value) {
      var keyConfig = this.__config[key];
      if (keyConfig.calculate && !keyConfig.calculateAsync) {
        // at this moment async properties updated from outside (state)
        throw new Error('only_writable_properties_allowed: ' + key);
      }

      this[key] = value;
      // console.log('set', key, value);
    }

    /**
     * Set computed properties through a redefine method
     *
     * Alternative: Object.defineProperty(this, key, { value: value });
     *   does not work in PhantomJS: https://github.com/ariya/phantomjs/issues/11856
     */

  }, {
    key: '_setComputed',
    value: function _setComputed(key, value) {
      if (!this.__config[key].calculate) {
        throw new Error('only_computed_properties_allowed:' + key);
      }
      this[key] = value;
    }

    /**
     * https://www.polymer-project.org/2.0/docs/about_20
     * No more dirty checking for objects or arrays. Unlike 1.x, when you make a notifying change to an object or array property, Polymer re-evaluates everything below that property (sub-properties, array items).
     * @param {String} propertyName Like 'ranges', 'name'
     * @param {*} value for this property
     * @returns {Boolean} Should prop change
     */

  }, {
    key: '_shouldPropChange',
    value: function _shouldPropChange(propertyName, value) {
      if (value === undefined) {
        throw new Error('value_cannot_be_undefined');
      }

      var old = this[propertyName];
      if (old === undefined) {
        throw new Error('property_must_exist: ' + propertyName);
      }

      // skip arrays and objects
      return (
        // Strict equality check for primitives
        old !== value && (
        // This ensures old:NaN, value:NaN always returns false
        old === old || value === value)
      );
    }
  }, {
    key: '_updateComputedPropertyIfNeeded',
    value: function _updateComputedPropertyIfNeeded(propertyName, value) {
      if (this._shouldPropChange(propertyName, value) === false) {
        return false;
      }

      var valueInstance = this._createInstanceFromValue(propertyName, value);
      this._setComputed(propertyName, valueInstance);
      return true;
    }

    /**
     * @param {String} propertyName Like 'ranges', 'name', etc.
     * @returns {Boolean} Whether the property updated
     */

  }, {
    key: '_updatePropertyIfNeeded',
    value: function _updatePropertyIfNeeded(propertyName, value) {
      if (this._shouldPropChange(propertyName, value) === false) {
        return false;
      }

      var valueInstance = this._createInstanceFromValue(propertyName, value);
      this._set(propertyName, valueInstance);
      return true;
    }
  }, {
    key: '_runPropEffects',
    value: function _runPropEffects(changedPropName) {
      var list = [];
      this.__effects.forEach(function (eff) {
        var scopeOfComputedPropNames = eff.compute(changedPropName);
        if (scopeOfComputedPropNames) {
          list.push(scopeOfComputedPropNames);
        }
      });

      // console.log('computedPropNames', computedPropNames);
      return list;
    }

    // if an object (not a property)
    // ['student', 'name'] = this.student
    // ['people', '0', 'name'] = this.people
    // .join('.')

  }, {
    key: '_updatePathObject',
    value: function _updatePathObject(objectName, nextParts, value) {
      var mainObject = this[objectName];

      // if no people.0
      if (!mainObject) {
        throw new Error('no_such_property_to_set: ' + objectName);
      }

      // this.student._updatePath
      // this.people - Array (no such method)
      var scopeOfInternalChanges;

      // this.people - Array (no inner methods)
      // nextPropertyPath = '0.name'
      if (Array.isArray(mainObject)) {
        // 2 = of [2, name] of people.2.name
        // 4 = of [4] of people.4
        // usa = of [usa, area] of countries.usa.area
        var elemPrimaryKey = nextParts[0];
        // search by index of an array
        // it can be replaced with search by id of item
        var mainItem = mainObject.filter(function (elem) {
          // country['id'] === 'usa'
          return elem[PRIMARY_KEY] + '' === elemPrimaryKey;
        })[0];

        // Looking by array index
        // var mainItem = mainObject[itemPart];
        if (!mainItem) {
          // console.log('mainItem', elemPrimaryKey, JSON.stringify(mainObject));
          throw new Error('cannot_update_nonexistent_item: ' + objectName + '.' + elemPrimaryKey);
        }
        // 'name' of [2,name] of people.2.name
        // '' of [4] of people.4
        var itemNextPropertyPath = nextParts.slice(1).join('.');
        if (!itemNextPropertyPath) {
          throw new Error('update_is_not_supported_for_path: ' + objectName + '.' + elemPrimaryKey + ' use removeItem + insertItem instead');
        }
        scopeOfInternalChanges = mainItem._updatePath(itemNextPropertyPath, value);
      } else {
        scopeOfInternalChanges = mainObject._updatePath(nextParts.join('.'), value);
      }

      if (!scopeOfInternalChanges) {
        return null;
      }

      var scopeOfComputedPropNames = {};
      scopeOfComputedPropNames[objectName] = this._runPropEffects(objectName);
      return scopeOfComputedPropNames;
    }

    /**
     * @param {String} propertyPath Scope of property names, like
     *   - 'someObject.someProperty'
     *   - 'name'
     *   - 'students[0].name' - index of element
     *   - 'people:3.name' - id of element
     *   - 'people:3'
     *   - 'countries:usa.area'
     * @param {*} value Any value
     */

  }, {
    key: '_updatePath',
    value: function _updatePath(propertyPath, value) {
      // levels of an object
      // 'student.name'
      // - student - 1st level
      // - name - 2nd level
      // or
      // 'countries.usa.area'
      // - countries
      // - usa - 2nd level
      // - area - 3rd level
      var levels = propertyPath.split('.');

      // main = 'student': ['student', 'name'] (object)
      // main = 'lastName': ['lastName'] (property of an object)
      // main = 'people' : ['people', '0', 'name'] (object = array)
      // main = '0' : ['0', 'name'] (object = item of an array)
      var mainLevel = levels[0];
      // console.log('_updatePath', propertyPath, propertyName);
      if (!mainLevel) {
        throw new Error('property_path_invalid: ' + propertyPath);
      }

      // if a property (not an object): name, lastName, age
      // or update a full object:
      // - 'student': { id:123, name: 'asdf'}
      // - 'countries.usa': { area: 345 }
      if (levels.length === 1) {
        var isChanged = this._updatePropertyIfNeeded(mainLevel, value);

        if (isChanged) {
          return this._runBatchedEffects([mainLevel]);
        }

        return null;
      }

      var nextLevels = levels.slice(1);
      // object
      return this._updatePathObject(mainLevel, nextLevels, value);
    }
  }, {
    key: 'update',
    value: function update(paths) {
      if (typeof paths !== 'object') {
        throw new Error('paths_required_object:' + paths);
      }

      // console.log('update(paths)', Object.keys(paths));
      var that = this;
      var changes = [];
      Object.keys(paths).forEach(function (propertyPath) {
        // console.log('propPath', propertyPath);
        var valueFresh = paths[propertyPath];
        var scopeOfChanges = that._updatePath(propertyPath, valueFresh);
        if (scopeOfChanges) {
          changes.push(scopeOfChanges);
        }
      });

      // console.log('changes:', JSON.stringify(changes));
      return changes;
    }

    /**
     * Run effects for few properties
     */

  }, {
    key: '_runBatchedEffects',
    value: function _runBatchedEffects(changedPropNames) {
      if (changedPropNames.length === 0) {
        return null;
      }

      var that = this;

      var scopeOfComputedPropNames = {};
      // console.log('changedPropNames', changedPropNames, this);
      changedPropNames.forEach(function (changedPropName) {
        var computedPropNames = that._runPropEffects(changedPropName);
        scopeOfComputedPropNames[changedPropName] = computedPropNames;
      });

      return scopeOfComputedPropNames;
    }

    /**
     * Update properties and run effects (computed props)
     * @param {Object} props Like { name: 'John', lastname: 'Bin' }
     * @returns {Object} Scope of computed property names (few items)
     */

  }, {
    key: '_updateProperties',
    value: function _updateProperties(props) {
      var callback = function (propertyName) {
        return this._updatePropertyIfNeeded(propertyName, props[propertyName]);
      };

      var changedPropNames = Object.keys(props).filter(callback.bind(this));

      return this._runBatchedEffects(changedPropNames);
    }

    /**
     * Insert to an array
     * - insertItem('tasks',  {id: 2, name: 'asdf'})
     */

  }, {
    key: 'insertItem',
    value: function insertItem(propName, item) {
      // TODO: use PrimaryKey config instead 'id'
      // TODO: verify id unique through all table
      // TODO: insert, using sorting by id
      if (item[PRIMARY_KEY] === null || item[PRIMARY_KEY] === undefined) {
        throw new Error('required_primary_key_for_prop: ' + PRIMARY_KEY + ': ' + propName);
      }

      var typeArray = this.__config[propName].type;
      if (Array.isArray(typeArray) === false) {
        throw new Error('insert_only_for_arrays:' + propName);
      }

      var currentList = this[propName];

      if (Array.isArray(currentList) === false) {
        throw new Error('insert_only_to_arrays:' + propName);
      }

      var existingIndex = findIndexByPrimaryKey(currentList, item[PRIMARY_KEY]);

      if (existingIndex >= 0) {
        return null;
      }

      var itemInstance = this._createInstanceFromValue(propName, item);

      currentList.push(itemInstance);

      var scopeOfPropNames = {};
      scopeOfPropNames[propName] = this._runPropEffects(propName);
      return scopeOfPropNames;
    }
  }, {
    key: 'removeItem',
    value: function removeItem(propName, primaryKey) {
      var typeArray = this.__config[propName].type;
      if (Array.isArray(typeArray) === false) {
        throw new Error('remove_only_for_arrays');
      }

      var currentList = this[propName];

      if (Array.isArray(currentList) === false) {
        throw new Error('remove_only_from_arrays:' + propName);
      }

      var existingIndex = findIndexByPrimaryKey(currentList, primaryKey);

      if (existingIndex < 0) {
        return null;
      }

      currentList.splice(existingIndex, 1);

      var scopeOfPropNames = {};
      scopeOfPropNames[propName] = this._runPropEffects(propName);
      return scopeOfPropNames;
    }
  }]);

  return Computer;
}();

module.exports = Computer;

},{"./effect":3,"./setting":5}],3:[function(require,module,exports){
/** @module */

'use strict';

/** An effect for some computed property */

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Effect = function () {
  function Effect(ctx, computedKey, watchedKeys, computation) {
    _classCallCheck(this, Effect);

    /**
     * Computed property
     * @type {String}
     */
    this.computedKey = computedKey;

    /**
     * Names of dependent properties
     * @type {String[]}
     */
    this.watchedKeys = watchedKeys;

    /**
     * A function, executed after watched props have been changed
     * @type {Function}
     */
    this.computation = computation;

    /**
     * Context, where properties are stored
     * @type {Object}
     */
    this.ctx = ctx;
  }

  /**
   * Run computation and update value
   * @param {String} changedKey Name of changed property
   * @returns {Object} Scope of computed properties
   */


  _createClass(Effect, [{
    key: 'compute',
    value: function compute(changedKey) {
      if (this.watchedKeys.indexOf(changedKey) < 0) {
        return null;
      }

      var ctx = this.ctx;

      var args = this.watchedKeys.map(function (watchedKey) {
        return ctx[watchedKey];
      });

      // var props = {};
      // props[this.computedKey] = this.computation.apply(null, args);
      // return ctx._updateProperties(props);

      var computationResult = this.computation.apply(null, args);

      var isChanged = ctx._updateComputedPropertyIfNeeded(this.computedKey, computationResult);

      if (isChanged) {
        return ctx._runBatchedEffects([this.computedKey]);
      }

      return null;
    }
  }]);

  return Effect;
}();

module.exports = Effect;

},{}],4:[function(require,module,exports){
/** @module */

'use strict';

/** A listener of store changes */

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Listener = function () {
  function Listener(callback, watchedKeys) {
    _classCallCheck(this, Listener);

    this.callback = callback;
    this.watchedKeys = watchedKeys;
  }

  /**
   * Filter and notify listeners
   * If no changedKeys or no watchedKeys - send it
   */


  _createClass(Listener, [{
    key: 'notify',
    value: function notify(changedKeys, state, writableState) {
      var isSend = false;
      if (this.watchedKeys && changedKeys) {
        isSend = this.watchedKeys.some(function (watchedKey) {
          return changedKeys.indexOf(watchedKey) >= 0;
        });
      } else {
        isSend = true;
      }

      if (isSend) {
        this.callback(changedKeys, state, writableState);
      }
    }
  }]);

  return Listener;
}();

module.exports = Listener;

},{}],5:[function(require,module,exports){
/** @module */

'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var areAllArgumentsFilled = function (args) {
  var arr = Array.prototype.slice.call(args);
  return arr.every(function (arg) {
    if (typeof arg === 'undefined') {
      throw new Error('argument_can_not_be_undefined: ' + arg);
    }

    return arg !== null;
  });
};

/**
 * Async properteis contains only computedAsync definition
 * There is a default function to compute initial values for async properties (null values for data and error)
 */
var defaultComputedForAsync = function () {
  if (areAllArgumentsFilled(arguments)) {
    return { data: null, error: null, loading: true };
  }

  return null;
};

/** Async wrapper for initial types */
var defaultTypeForAsync = function (initialType) {
  return {
    data: { type: initialType },
    error: { type: String },
    loading: { type: Boolean }
    // null (not yet defined) or true
    // isLoading: {
    //   type: Boolean,
    //   computed: ['data', 'error', function(data, error) {
    //     //if (data === null && error === null) { return null; }
    //     //return data === null && error === null;
    //     return true;
    //   }]
    // }
  };
};

/**
 * Convert from JSON configuration to Setting model
 * all async properties are computed
 * all writable properties can not be async
 * add a default computed function for async properties
 */

var Setting = function Setting(propName, propConfig) {
  _classCallCheck(this, Setting);

  if (!propConfig.type) {
    throw new Error('required_type: ' + propName + ': ' + propConfig.type);
  }

  var computed = propConfig.computed;
  var computedAsync = propConfig.computedAsync;

  if (computed && computedAsync) {
    throw new Error('use_computed_or_computedAsync: ' + propName);
  }

  // add a wrap for async properties
  // Number -> Async(Number)
  this.type = computedAsync ? defaultTypeForAsync(propConfig.type) : propConfig.type;

  // exit for simple writable properties
  // continue for computed props
  if (!computed && !computedAsync) {
    return;
  }

  this.watchedKeys = (computed || computedAsync).slice(0, -1);

  if (!this.watchedKeys || this.watchedKeys.length < 1) {
    throw new Error('required_array_of_watched_keys: ' + propName);
  }

  // TODO: add default behavior for all computed properties:
  // if (areAllArgumentsFilled(arguments) === false) return null;
  this.calculate = computedAsync ? defaultComputedForAsync : computed.slice(-1)[0];

  if (!this.calculate || typeof this.calculate !== 'function') {
    throw new Error('required_calculation_function: ' + propName);
  }

  // additional function only for async props
  if (computedAsync) {
    this.calculateAsync = computedAsync.slice(-1)[0];

    if (!this.calculateAsync || typeof this.calculateAsync !== 'function') {
      throw new Error('required_async_calculation_function: ' + propName);
    }
  }
};

module.exports = Setting;

},{}],6:[function(require,module,exports){
var ComputedState = require('./src/computed-state');
window.ComputedState = ComputedState;

},{"./src/computed-state":1}]},{},[6]);
