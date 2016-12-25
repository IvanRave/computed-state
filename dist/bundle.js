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
    if (!obj.__config[key].computed) {
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
      // console.log('scopeOfChangedKeys', JSON.stringify(scopeOfChangedKeys));
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

    /**
     * @returns {Object} Scope of writable properties (without computed)
     *  e.g: to backup it
     */

  }, {
    key: 'getWritableState',
    value: function getWritableState() {
      return getWritableProperties(this.state);
    }
  }, {
    key: 'ready',
    value: function ready(changedKeys) {
      var state = this.getState();
      var writableState = this.getWritableState();

      this.listeners.forEach(function (listener) {
        listener.notify(changedKeys, state, writableState);
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
/** @module */

'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Effect = require('./effect');

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

      throw new TypeError('required type: ' + PropConfigType);
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
      if (this.__config[key].computed) {
        throw new Error('only_writable_properties_allowed:' + key);
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
      if (!this.__config[key].computed) {
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
      //console.log('changedPropNames', changedPropNames, this);
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

},{"./effect":3}],3:[function(require,module,exports){
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
var ComputedState = require('./src/computed-state');
window.ComputedState = ComputedState;

},{"./src/computed-state":1}]},{},[5]);
