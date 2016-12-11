(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/** @module */

var Listener = require('./listener');
var Computer = require('./computer');

var toPlainChangedKeys = function (scope, total) {
  if (!scope) {
    throw new Error('toPlainChangedKeys_scope_required');
  }

  if (Array.isArray(scope) === true) {
    scope.forEach(function (item) {
      toPlainChangedKeys(item, total);
    });
  } else {
    // if Object
    Object.keys(scope).forEach(function (key) {
      if (total.indexOf(key) < 0) {
        total.push(key);
      }
      toPlainChangedKeys(scope[key], total);
    });
  }
};

var ComputedState = function () {
  function ComputedState(rootConfig) {
    _classCallCheck(this, ComputedState);

    this.state = new Computer(rootConfig);
    this.listeners = [];
  }

  _createClass(ComputedState, [{
    key: 'operate',
    value: function operate(scopeOfChangedKeys) {
      if (!scopeOfChangedKeys || scopeOfChangedKeys.length === 0) {
        return;
      }

      var allChangedKeys = [];
      toPlainChangedKeys(scopeOfChangedKeys, allChangedKeys);
      this.ready(allChangedKeys);
    }

    /** Copy an return a current state */

  }, {
    key: 'getState',
    value: function getState() {
      return JSON.parse(JSON.stringify(this.state));
    }
  }, {
    key: 'ready',
    value: function ready(changedKeys) {
      var state = this.getState();

      this.listeners.forEach(function (listener) {
        listener.notify(changedKeys, state);
      });
    }
  }, {
    key: 'update',
    value: function update(props) {
      this.operate(this.state.update(props));
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
  }]);

  return ComputedState;
}();

module.exports = ComputedState;

},{"./computer":2,"./listener":4}],2:[function(require,module,exports){
var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/** @module */

var Effect = require('./effect');

var findIndexById = function (list, id) {
  for (var i = 0, l = list.length; i < l; i += 1) {
    if (list[i].id === id) {
      return i;
    }
  }
  return -1;
};

var hasOwnProperty = function (inst, propName) {
  return {}.hasOwnProperty.call(inst, propName);
};

/**
 * https://www.polymer-project.org/2.0/docs/about_20
 * No more dirty checking for objects or arrays. Unlike 1.x, when you make a notifying change to an object or array property, Polymer re-evaluates everything below that property (sub-properties, array items).
 */
var shouldPropChange = function (value, old) {
  // skip arrays and objects
  return (
    // Strict equality check for primitives
    old !== value && (
    // This ensures old:NaN, value:NaN always returns false
    old === old || value === value)
  );
};

/** A class to create calculated objects from specific configuration */

var Computer = function () {
  function Computer(config, initialProps) {
    _classCallCheck(this, Computer);

    Object.defineProperty(this, '__effects', {
      value: [],
      writable: false,
      enumerable: false,
      configurable: false
    });

    Object.defineProperty(this, '__config', {
      value: config,
      writable: false,
      enumerable: false,
      configurable: false
    });

    Object.keys(config).forEach(this._createProperty.bind(this, config));

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
    value: function _createProperty(props, propName) {
      var propSettings = props[propName];

      var settingType = propSettings.type;
      if (!settingType) {
        throw new Error('required_type: ' + propName + ': ' + propSettings.type);
      }

      Object.defineProperty(this, propName, {
        value: Array.isArray(settingType) ? [] : null,
        writable: true,
        enumerable: true,
        configurable: false
      });

      if (propSettings.computed) {
        this._attachComputedProps(propName, propSettings.computed);
      }
    }
  }, {
    key: '_attachComputedProps',
    value: function _attachComputedProps(propName, settingComputed) {
      var watchedKeys = settingComputed.slice(0, -1);
      var calculation = settingComputed.slice(-1)[0];

      if (!calculation || typeof calculation !== 'function') {
        throw new Error('required_calculation_function: ' + propName);
      }

      if (!watchedKeys || watchedKeys.length < 1) {
        throw new Error('required_array_of_watched_keys: ' + propName);
      }

      watchedKeys.forEach(this._verifyWatchedKey.bind(this));

      this.__effects.push(new Effect(this, propName, watchedKeys, calculation));
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
    key: '_createInstanceFromValue',
    value: function _createInstanceFromValue(propName, value) {
      if (value === null) {
        return null;
      }

      var settingType = this.__config[propName].type;
      var PropConfigType = Array.isArray(settingType) ? settingType[0] : settingType;

      if (value.constructor !== PropConfigType) {
        if (typeof PropConfigType === 'object') {
          return new Computer(PropConfigType, value);
        }

        throw new TypeError('required type: ' + PropConfigType + ' for propName: ' + propName);
      }

      return value;
    }
  }, {
    key: '_set',
    value: function _set(key, value) {
      this[key] = value;
      // console.log('set', key, value);
    }

    /**
     * @returns {Boolean} Whether the property updated
     */

  }, {
    key: '_updatePropertyIfNeeded',
    value: function _updatePropertyIfNeeded(props, propertyName) {
      var value = props[propertyName];

      if (value === undefined) {
        throw new Error('value_cannot_be_undefined');
      }

      var oldValue = this[propertyName];

      if (oldValue === undefined) {
        throw new Error('no_such_property_to_set:' + propertyName);
      }

      // TODO: thow Error if set computed value not from computation

      if (shouldPropChange(value, oldValue) === true) {
        var valueInstance = this._createInstanceFromValue(propertyName, value);
        this._set(propertyName, valueInstance);
        return true;
      }

      return false;
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
  }, {
    key: '_updatePath',
    value: function _updatePath(propertyPath, value) {
      var parts = propertyPath.split('.');
      var propertyName = parts[0];
      if (!propertyName) {
        throw new Error('property_path_invalid: ' + propertyPath);
      }

      if (parts.length === 1) {
        var objectToUpdate = {};
        objectToUpdate[propertyName] = value;
        return this._updateProperties(objectToUpdate);
      }

      // parts.length > 1
      if (this[propertyName] === null) {
        throw new Error('no_such_property_to_set:' + propertyName);
      }

      var nextPropertyPath = parts.slice(1).join('.');

      var scopeOfInternalChanges = this[propertyName]._updatePath(nextPropertyPath, value);

      if (!scopeOfInternalChanges) {
        return null;
      }

      var scopeOfComputedPropNames = {};
      var computedPropNames = this._runPropEffects(propertyName);
      scopeOfComputedPropNames[propertyName] = computedPropNames;

      return scopeOfComputedPropNames;
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
     * Update properties and run effects (computed props)
     * @returns {Object} Scope of computed property names (few items)
     */

  }, {
    key: '_updateProperties',
    value: function _updateProperties(props) {
      var changedPropNames = Object.keys(props).filter(this._updatePropertyIfNeeded.bind(this, props));

      if (changedPropNames.length === 0) {
        return null;
      }

      var that = this;

      var scopeOfComputedPropNames = {};
      //console.log('changedPropNames', changedPropNames, this);
      changedPropNames.forEach(function (changedPropName) {
        var computedPropNames = that._runPropEffects(changedPropName);
        scopeOfComputedPropNames[changedPropName] = computedPropNames;
      });

      return scopeOfComputedPropNames;
    }

    /**
     * Insert to an array
     * - insertItem('tasks',  {id: 2, name: 'asdf'})
     */

  }, {
    key: 'insertItem',
    value: function insertItem(propName, item) {
      if (item.id === null || item.id === undefined) {
        throw new Error('required_id_for_prop: ' + propName);
      }

      var typeArray = this.__config[propName].type;
      if (Array.isArray(typeArray) === false) {
        throw new Error('insert_only_for_arrays:' + propName);
      }

      var currentList = this[propName];

      if (Array.isArray(currentList) === false) {
        throw new Error('insert_only_to_arrays:' + propName);
      }

      var existingIndex = findIndexById(currentList, item.id);

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
    value: function removeItem(propName, id) {
      var typeArray = this.__config[propName].type;
      if (Array.isArray(typeArray) === false) {
        throw new Error('remove_only_for_arrays');
      }

      var currentList = this[propName];

      if (Array.isArray(currentList) === false) {
        throw new Error('remove_only_from_arrays:' + propName);
      }

      var existingIndex = findIndexById(currentList, id);

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

},{"./effect":3}],3:[function(require,module,exports){
var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/** @module */

/** An effect for some computed property */
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
   * @param {String} changedKey Name of changed property
   * @returns {Object} Scope of computed properties
   */


  _createClass(Effect, [{
    key: "compute",
    value: function compute(changedKey) {
      if (this.watchedKeys.indexOf(changedKey) < 0) {
        return null;
      }

      var ctx = this.ctx;

      var args = this.watchedKeys.map(function (watchedKey) {
        return ctx[watchedKey];
      });

      var props = {};
      props[this.computedKey] = this.computation.apply(null, args);
      return ctx.update(props);
    }
  }]);

  return Effect;
}();

module.exports = Effect;

},{}],4:[function(require,module,exports){
var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/** @module */

/** A listener of store changes */
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
    key: "notify",
    value: function notify(changedKeys, state) {
      var isSend = false;
      if (this.watchedKeys && changedKeys) {
        isSend = this.watchedKeys.some(function (watchedKey) {
          return changedKeys.indexOf(watchedKey) >= 0;
        });
      } else {
        isSend = true;
      }

      if (isSend) {
        this.callback(changedKeys, state);
      }
    }
  }]);

  return Listener;
}();

module.exports = Listener;

},{}],5:[function(require,module,exports){
var ComputedState = require('./src/computed-state');
window.ComputedState = ComputedState;

},{"./src/computed-state":1}]},{},[5]);
