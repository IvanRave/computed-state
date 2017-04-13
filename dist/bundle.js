(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/** @module */

'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Listener = require('./listener');
var Computer = require('./computer');
var Setting = require('./setting');

var toPlainChangedPaths = function (scope, target) {
  if (!scope) {
    throw new Error('toPlainChangedPaths_scope_required');
  }

  if (Array.isArray(scope) === true) {
    scope.forEach(function (item) {
      toPlainChangedPaths(item, target);
    });
  } else {
    Object.keys(scope).forEach(function (key) {
      if (target.indexOf(key) < 0) {
        target.push(key);
      }
      toPlainChangedPaths(scope[key], target);
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
    if (!obj.__settings[key].calculate) {
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
    var propSetting = obj.__settings[key];
    var calculateAsync = propSetting.calculateAsync;
    var watchedKeys = propSetting.watchedKeys;

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

/**
 * @param {Function} callback Executed when keys are changed
 * @param {String[]} watchedKeys List of property keys
 * @todo watchedPaths instead keys
 * @param {Listener[]} anyListeners List of async or usual listeners
 * @returns {Function} unsubscribe - remove subscription
 */
var subscribeAny = function (callback, watchedKeys, anyListeners) {
  var listener = new Listener(callback, watchedKeys);
  anyListeners.push(listener);
  return function () {
    var index = anyListeners.indexOf(listener);
    anyListeners.splice(index, 1);
  };
};

/**
 * Build settings from config
 * config is more readable; settings - usable
 * @param {Object} config { name: {type:'Text'}, ... }
 * @returns {Object} Scope of instances of settings
 */
var buildSettings = function (config) {
  var settings = {};
  Object.keys(config).forEach(function (propName) {
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

var ComputedState = function () {
  function ComputedState(rootEntityConfig, initialPrimaryKey) {
    _classCallCheck(this, ComputedState);

    var primaryKey = initialPrimaryKey || 'id';

    var rootSettings = buildSettings(rootEntityConfig);

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


  _createClass(ComputedState, [{
    key: 'operate',
    value: function operate(scopeOfChangedKeys, skippedPropertyKey) {
      if (!scopeOfChangedKeys || scopeOfChangedKeys.length === 0) {
        return;
      }
      // console.log('scopeOfChangedKeys', JSON.stringify(scopeOfChangedKeys));
      // TODO: convert to changed paths instead keys (or add to output)
      var allChangedPaths = [];
      toPlainChangedPaths(scopeOfChangedKeys, allChangedPaths);
      this.ready(allChangedPaths);

      // remove skipped items
      var neededChangedPaths = allChangedPaths.filter(function (key) {
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

  }, {
    key: 'handleAsyncProps',
    value: function handleAsyncProps(allChangedPaths) {
      var asyncPaths = getAsyncPaths(this._rootEntity);

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

  }, {
    key: 'getEntity',
    value: function getEntity() {
      return this._rootEntity;
      // TODO: or copy
      // return JSON.parse(JSON.stringify(this._rootEntity));
    }

    /**
     * @returns {Object} Scope of writable properties (without computed)
     *  e.g: to backup it
     */

  }, {
    key: 'getWritableEntity',
    value: function getWritableEntity() {
      var writableEntity = getWritableProperties(this._rootEntity);
      // console.log('w', writableState);
      return writableEntity;
    }
  }, {
    key: 'update',
    value: function update(paths) {
      this.operate(this._rootEntity.update(paths));
    }

    /** Update all properties, but skip re-async for async props */

  }, {
    key: '_updateAsyncProperty',
    value: function _updateAsyncProperty(propertyPath, propertyValue) {
      var upd = {};
      upd[propertyPath] = propertyValue;
      this.operate(this._rootEntity.update(upd), propertyPath);
    }
  }, {
    key: 'insertItem',
    value: function insertItem(propertyPath, item) {
      this.operate(this._rootEntity.insertItem(propertyPath, item));
    }
  }, {
    key: 'removeItem',
    value: function removeItem(propertyPath, primaryKeyValue) {
      this.operate(this._rootEntity.removeItem(propertyPath, primaryKeyValue));
    }
  }, {
    key: 'subscribe',
    value: function subscribe(callback, watchedKeys) {
      return subscribeAny(callback, watchedKeys, this._listeners);
    }
  }, {
    key: 'subscribeAsync',
    value: function subscribeAsync(callback, watchedKeys) {
      return subscribeAny(callback, watchedKeys, this._asyncListeners);
    }

    /** When all sync operations are finished */

  }, {
    key: 'ready',
    value: function ready(changedKeys) {
      var state = this.getEntity();
      var writableState = this.getWritableEntity();

      this._listeners.forEach(function (listener) {
        listener.notify(changedKeys, state, writableState);
      });
    }

    /** When all async operations are finished */

  }, {
    key: 'readyAsync',
    value: function readyAsync(changedAsyncKeys) {
      var state = this.getEntity();
      var writableState = this.getWritableEntity();

      this._asyncListeners.forEach(function (listener) {
        listener.notify(changedAsyncKeys, state, writableState);
      });
    }
  }]);

  return ComputedState;
}();

module.exports = ComputedState;

},{"./computer":2,"./listener":4,"./setting":5}],2:[function(require,module,exports){
/** @module */

'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Effect = require('./effect');

var findIndexByKeyValue = function (list, propertyKey, propertyValue) {
  for (var i = 0, l = list.length; i < l; i += 1) {
    if (list[i][propertyKey] === propertyValue) {
      return i;
    }
  }
  return -1;
};

var findItemByKeyValue = function (list, propertyKey, propertyValueString) {
  return list.filter(function (elem) {
    // country['id'] === 'usa'
    // 'members.5.name' -  typeof '5' === 'string'
    return elem[propertyKey] + '' === propertyValueString;
  })[0];
};

var hasOwnProperty = function (inst, propName) {
  return {}.hasOwnProperty.call(inst, propName);
};

var pathToLevels = function (propertyPath) {
  return propertyPath.split('.');
};

var levelsToPath = function (levels) {
  return levels.join('.');
};

/** A class to create calculated objects from specific configuration */

var Computer = function () {
  /**
   * @param {Object} settings Common settings for all instances
   * @param {String?} primaryKey A name of primary property, like 'id'
   */
  function Computer(settings, primaryKey) {
    _classCallCheck(this, Computer);

    if (!settings) {
      throw new Error('required_settings');
    }
    if (!primaryKey) {
      throw new Error('required_primaryKey');
    }

    Object.defineProperty(this, '__primary', {
      value: primaryKey,
      writable: false,
      enumerable: false,
      configurable: false
    });

    Object.defineProperty(this, '__effects', {
      value: [],
      writable: false,
      enumerable: false,
      configurable: false
    });

    // save settings for future using
    Object.defineProperty(this, '__settings', {
      value: settings,
      writable: false,
      enumerable: false,
      configurable: false
    });

    // create properties from settings
    Object.keys(this.__settings).forEach(this._createProperty.bind(this));
  }

  /**
   * Default value for properties: null
   * @param {String} propName Property name, like 'birthDate'
   * @returns {Object} Result of creation
   */


  _createClass(Computer, [{
    key: '_createProperty',
    value: function _createProperty(propName) {
      var propertySetting = this.__settings[propName];

      Object.defineProperty(this, propName, {
        value: propertySetting.type === 'ItemList' ? [] : null,
        writable: true,
        enumerable: true,
        configurable: false
      });

      if (propertySetting.calculate) {
        this._attachComputedProps(propName, propertySetting.watchedKeys, propertySetting.calculate);
      }
    }
  }, {
    key: '_attachComputedProps',
    value: function _attachComputedProps(propName, watchedKeys, calculate) {
      watchedKeys.forEach(this._verifyWatchedKey.bind(this));

      this.__effects.push(new Effect(this, propName, watchedKeys, calculate));
    }

    /**
     * Wached properties must be declared before computed properties
     * @param {String} watchedKey One of ['firstName', 'lastName']
     * @returns {*} Result of verification
     */

  }, {
    key: '_verifyWatchedKey',
    value: function _verifyWatchedKey(watchedKey) {
      if (!watchedKey || hasOwnProperty(this, watchedKey) === false) {
        throw new Error('required_dependent_property: ' + watchedKey);
      }
    }

    /**
     * Create computed instances only for 'ref' (not for 'type')
     * @param {Object} entityConfig Entity config: props, metadata
     * @param {*} value Value of this property
     * @returns {*} Value (for primitives) or instance of type (for entities)
     */

  }, {
    key: '_createByType',
    value: function _createByType(entityConfig, value) {
      // value = { name: 'bar', lname: 'foo', person: { age: 123 } }
      // 1. create 2. update props (with effects)
      var needEntity = new this.constructor(entityConfig, this.__primary);
      needEntity.update(value);
      return needEntity;
    }

    /**
     * For example, create Instance from array
     * 'events': [{start: 123, end: 234}, {...}, ...]
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

      var propSetting = this.__settings[propName];

      // TODO:
      var settingType = propSetting.type;

      // referenced entity, like event.place
      var entitySettings = propSetting.refSettings;

      // console.log('refEntity', refEntity && Object.keys(refEntity));

      var that = this;

      // if (Array.isArray(value)) {
      if (settingType === 'ItemList') {
        if (!entitySettings) {
          throw new Error('required_ref_for_item_list: ' + propName + ' ' + JSON.stringify(value));
        }

        if (Array.isArray(value) === true) {
          return value.map(function (itemValue) {
            return that._createByType(entitySettings, itemValue);
          });
          // throw new Error('required_array: ' + propName + ' ' + JSON.stringify(value));
        }

        // create for insertItem method
        return this._createByType(entitySettings, value);
      } else if (settingType === 'Item') {
        if (!entitySettings) {
          throw new Error('required_ref_for_item: ' + propName);
        }
        return this._createByType(entitySettings, value);
      }

      // TODO: hack for async properties
      if (this.__settings[propName].calculateAsync) {
        return value;
      }

      // verify type of value
      // Item and ItemList is already verified during entity.update
      // all types must be verified on ViewSide:
      //  on ModelSide just checking with exceptions
      // if (types[settingType].isValid(value) === false) {
      //   throw new Error('type_mismatch: ' + propName + ': ' + value + ': ' + settingType);
      // }

      return value;
    }
  }, {
    key: '_set',
    value: function _set(key, value) {
      var propSetting = this.__settings[key];
      if (propSetting.calculate && !propSetting.calculateAsync) {
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
     * @param {String} key Property name
     * @param {*} value New property value
     * @returns {undefined} Result of setting
     */

  }, {
    key: '_setComputed',
    value: function _setComputed(key, value) {
      if (!this.__settings[key].calculate) {
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
     * @param {*} value To update
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

    /**
     * Find the entity (one or item from array) and fire associatedCommand
     *   and run propEffects for middle entities
     * If an object (not a property)
     * ['student', 'name'] = this.student
     * ['people', '0', 'name'] = this.people
     * @param {String} entityName Like 'student'
     * @param {Array<String>} nextLevels Like ['5', 'grades']
     * @param {*} value Value to update | insert | remove
     * @param {String} associatedCommand Update|Insert|Remove
     * @returns {Object} Scope of changes
     */

  }, {
    key: '_iterateLevels',
    value: function _iterateLevels(entityName, nextLevels, value, associatedCommand) {
      var mainEntity = this[entityName];

      // if no people.0
      if (!mainEntity) {
        throw new Error('no_such_property_to_set: ' + entityName);
      }

      // this.student._updatePath
      // this.people - Array (no such method)
      var needEntity;
      var needLevels;
      // this.people - Array (no inner methods)
      // nextPropertyPath = '0.name'
      // if 'students' or 'people'
      if (Array.isArray(mainEntity)) {
        // 2 = of [2, name] of people.2.name
        // 4 = of [4] of people.4
        // usa = of [usa, area] of countries.usa.area
        var elemPrimaryKey = nextLevels[0];
        // search by index of an array
        // it can be replaced with search by id of item
        var mainItem = findItemByKeyValue(mainEntity, this.__primary, elemPrimaryKey);

        if (!mainItem) {
          // console.log('mainItem', elemPrimaryKey, JSON.stringify(mainObject));
          throw new Error('cannot_update_nonexistent_item: ' + entityName + '.' + elemPrimaryKey);
        }

        needEntity = mainItem;
        needLevels = nextLevels.slice(1);
      } else {
        needEntity = mainEntity;
        needLevels = nextLevels;
      }

      if (needLevels.length < 1) {
        throw new Error('update_is_not_supported_for_path: ' + entityName);
      }

      var scopeOfInternalChanges = needEntity[associatedCommand](levelsToPath(needLevels), value);

      if (!scopeOfInternalChanges) {
        return null;
      }

      var scopeOfComputedPropNames = {};
      scopeOfComputedPropNames[entityName] = this._runPropEffects(entityName);
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
     * @returns {Object} Scope of changes
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
      var levels = pathToLevels(propertyPath);

      // main = 'student': ['student', 'name'] (object)
      // main = 'lastName': ['lastName'] (property of an object)
      // main = 'people' : ['people', '0', 'name'] (object = array)
      // main = '0' : ['0', 'name'] (object = item of an array)
      var mainLevel = levels[0];
      // console.log('_updatePath', propertyPath, propertyName);
      if (!mainLevel) {
        throw new Error('property_path_invalid: ' + propertyPath);
      }

      if (levels.length > 1) {
        return this._iterateLevels(mainLevel, levels.slice(1), value, '_updatePath');
      }

      // if a property (not an object): name, lastName, age
      // or update a full object:
      // - 'student': { id:123, name: 'asdf'}
      // - 'countries.usa': { area: 345 }
      // if (levels.length === 1) {
      var isChanged = this._updatePropertyIfNeeded(mainLevel, value);
      if (isChanged) {
        return this._runBatchedEffects([mainLevel]);
      }
      return null;
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
     * @param {String[]} changedPropNames Like ['name', 'lastName']
     * @returns {Object} Scope of computed property names
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
  }, {
    key: '_insertItemByPropertyName',
    value: function _insertItemByPropertyName(propertyName, item) {
      var propertySetting = this.__settings[propertyName];

      if (!propertySetting) {
        throw new Error('no_such_property_to_insert: ' + propertyName);
      }

      var propertyType = propertySetting.type;

      if (propertyType !== 'ItemList') {
        throw new Error('required_ItemList_type_to_insert:' + propertyName);
      }

      // [{ id: 123, name: 'John' }, { id: 234, name: Jane }]
      var currentList = this[propertyName];

      if (Array.isArray(currentList) === false) {
        throw new Error('required_array_to_insert:' + propertyName);
      }

      var primaryPropertyKey = this.__primary;

      // TODO: verify id unique through all table
      // TODO: insert, using sorting by id
      if (item[primaryPropertyKey] === null || item[primaryPropertyKey] === undefined) {
        throw new Error('required_primary_key_for_prop: ' + primaryPropertyKey + ': ' + propertyName);
      }

      var existingIndex = findIndexByKeyValue(currentList, primaryPropertyKey, item[primaryPropertyKey]);

      if (existingIndex >= 0) {
        console.log('already_exist: ' + propertyName);
        return null;
      }

      // ('students', {id: 1, name: 'Jane'})
      var itemInstance = this._createInstanceFromValue(propertyName, item);

      // append new item to the store
      currentList.push(itemInstance);

      var scopeOfPropNames = {};
      scopeOfPropNames[propertyName] = this._runPropEffects(propertyName);
      return scopeOfPropNames;
    }

    /**
     * Insert to an array
     * - insertItem('tasks',  {id: 2, name: 'asdf'})
     * @param {String} propertyPath Like 'groups', 'students',
     *                 'groups.5.members', 'student.grades'
     * @param {Object} item Entity data: { id: 1, name: 'asdf' }
     * @returns {undefined}
     */

  }, {
    key: 'insertItem',
    value: function insertItem(propertyPath, item) {
      // duplication of _updatePath
      var levels = pathToLevels(propertyPath);
      var mainLevel = levels[0];
      if (!mainLevel) {
        throw new Error('property_path_invalid: ' + propertyPath);
      }

      if (levels.length > 1) {
        return this._iterateLevels(mainLevel, levels.slice(1), item, 'insertItem');
      }

      return this._insertItemByPropertyName(propertyPath, item);
    }
  }, {
    key: 'removeItem',
    value: function removeItem(propertyPath, primaryKeyValue) {
      var levels = pathToLevels(propertyPath);

      if (levels.length > 1) {
        return this._iterateLevels(levels[0], levels.slice(1), primaryKeyValue, 'removeItem');
        // return null;
      }

      var propertyName = propertyPath;

      if (!this.__settings[propertyName]) {
        throw new Error('no_such_property_to_remove: ' + propertyName);
      }

      var propType = this.__settings[propertyName].type;
      // if (Array.isArray(typeArray) === false) {
      if (propType !== 'ItemList') {
        throw new Error('required_ItemList_to_remove: ' + propertyName);
      }

      var currentList = this[propertyName];

      if (Array.isArray(currentList) === false) {
        throw new Error('required_array_value_to_remove:' + propertyName);
      }

      var existingIndex = findIndexByKeyValue(currentList, this.__primary, primaryKeyValue);

      if (existingIndex < 0) {
        console.log('record_not_found: ', primaryKeyValue, currentList);
        return null;
      }

      // remove item from the store
      currentList.splice(existingIndex, 1);

      var scopeOfPropNames = {};
      scopeOfPropNames[propertyName] = this._runPropEffects(propertyName);
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
/**
 * Creates an internal object from readable settings
 * - async type
 * - computed function + watched keys
 * @todo: precompile these objects from config
 * @module
 */

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
 * Async properties contains only computedAsync definition
 * There is a default function to compute initial values for async properties (null values for data and error)
 * @returns {Object} Default object for computed async
 */
var defaultComputedForAsync = function () {
  if (areAllArgumentsFilled(arguments)) {
    return { data: null, error: null, loading: true };
  }

  return null;
};

var buildSettings = function (config) {
  var settings = {};
  Object.keys(config).forEach(function (propName) {
    settings[propName] = new Setting(propName, config[propName]); // eslint-disable-line
  });

  return settings;
};

var attachProps = function (initialSetting, propConfig) {
  var setting = initialSetting;
  setting.type = propConfig.type;
  // <label>My input</label> for according input or span

  if (propConfig.label) {
    setting.label = propConfig.label;
  }

  if (propConfig.schema) {
    // http://schema.org
    setting.schema = propConfig.schema;
  }

  if (propConfig.sameAsProperty) {
    setting.sameAsProperty = propConfig.sameAsProperty;
  }
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
    throw new Error('required_type: ' + propName);
  }

  if (typeof propConfig.type !== 'string') {
    throw new Error('required_prop_type_string: ' + propName);
  }

  // propConfig.label is optional

  var computed = propConfig.computed;
  var computedAsync = propConfig.computedAsync;

  if (computed && computedAsync) {
    throw new Error('use_computed_or_computedAsync: ' + propName);
  }

  if (computedAsync) {
    var innerType = {};
    attachProps(innerType, propConfig);

    if (propConfig.ref) {
      innerType.ref = propConfig.ref;
    }

    this.type = 'Item';
    this.label = 'AsyncItem';
    this.refSettings = buildSettings({
      data: innerType,
      error: {
        type: 'Text',
        label: 'Error'
      },
      // TODO: to computed
      // if data is null and error is null, then loading?
      loading: {
        type: 'Boolean',
        label: 'Loading'
      }
    });
    this.schema = 'AsyncItem';
  } else {
    attachProps(this, propConfig);

    if (propConfig.ref) {
      // TODO: combine ref + schema
      // this.ref = propConfig.ref;
      this.refSettings = buildSettings(propConfig.ref);
    }
  }

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
