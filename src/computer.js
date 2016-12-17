/** @module */

var Effect = require('./effect');

var findIndexById = function(list, id) {
  for (var i = 0, l = list.length; i < l; i += 1) {
    if (list[i].id === id) {
      return i;
    }
  }
  return -1;
};

var hasOwnProperty = function(inst, propName) {
  return {}.hasOwnProperty.call(inst, propName);
};

/** A class to create calculated objects from specific configuration */
class Computer {
  constructor(config, initialProps) {
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
  _createProperty(props, propName) {
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

  _attachComputedProps(propName, settingComputed) {
    var watchedKeys = settingComputed.slice(0, -1);
    var calculation = settingComputed.slice(-1)[0];

    if (!calculation || typeof calculation !== 'function') {
      throw new Error('required_calculation_function: ' + propName);
    }

    if (!watchedKeys || watchedKeys.length < 1) {
      throw new Error('required_array_of_watched_keys: ' + propName);
    }

    watchedKeys.forEach(this._verifyWatchedKey.bind(this));

    this.__effects.push(new Effect(this,
                                   propName,
                                   watchedKeys,
                                   calculation));
  }

  /** Wached properties must be declared before computed properties */
  _verifyWatchedKey(watchedKey) {
    if (!watchedKey || hasOwnProperty(this, watchedKey) === false) {
      throw new Error('required_dependent_property: ' + watchedKey);
    }
  }

  _createByType(PropConfigType, value) {
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
  _createInstanceFromValue(propName, value) {
    if (value === null) { return null; }
    var settingType = this.__config[propName].type;
    var PropConfigType = Array.isArray(settingType) ?
          settingType[0] : settingType;

    var that = this;
    if (Array.isArray(value)) {
      return value.map(function(itemValue) {
        return that._createByType(PropConfigType, itemValue);
      });
    }

    return this._createByType(PropConfigType, value);
  }

  _set(key, value) {
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
  _setDefine(key, value) {
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
  _shouldPropChange(propertyName, value) {
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
      (old !== value &&
       // This ensures old:NaN, value:NaN always returns false
       (old === old || value === value)) // eslint-disable-line no-self-compare
    );
  }

  _updateComputedPropertyIfNeeded(propertyName, value) {
    if (this._shouldPropChange(propertyName, value) === false) {
      return false;
    }

    var valueInstance = this._createInstanceFromValue(propertyName, value);
    this._setDefine(propertyName, valueInstance);
    return true;
  }

  /**
   * @param {String} propertyName Like 'ranges', 'name', etc.
   * @returns {Boolean} Whether the property updated
   */
  _updatePropertyIfNeeded(propertyName, value) {
    if (this._shouldPropChange(propertyName, value) === false) {
      return false;
    }

    var valueInstance = this._createInstanceFromValue(propertyName, value);
    this._set(propertyName, valueInstance);
    return true;
  }

  _runPropEffects(changedPropName) {
    var list = [];
    this.__effects.forEach(function(eff) {
      var scopeOfComputedPropNames = eff.compute(changedPropName);
      if (scopeOfComputedPropNames) {
        list.push(scopeOfComputedPropNames);
      }
    });

    // console.log('computedPropNames', computedPropNames);
    return list;
  }

  /**
   * @param {String} propertyPath 'someObject.someProperty' or 'name'
   * @param {*} value Any value
   */
  _updatePath(propertyPath, value) {
    var parts = propertyPath.split('.');
    var propertyName = parts[0];
    // console.log('_updatePath', propertyPath, propertyName);
    if (!propertyName) {
      throw new Error('property_path_invalid: ' + propertyPath);
    }

    if (parts.length === 1) {
      var isChanged = this._updatePropertyIfNeeded(propertyName,
                                                   value);

      if (isChanged) {
        return this._runBatchedEffects([propertyName]);
      }

      return null;
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

  update(paths) {
    if (typeof paths !== 'object') {
      throw new Error('paths_required_object:' + paths);
    }

    // console.log('update(paths)', Object.keys(paths));
    var that = this;
    var changes = [];
    Object.keys(paths).forEach(function(propertyPath) {
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
  _runBatchedEffects(changedPropNames) {
    if (changedPropNames.length === 0) {
      return null;
    }

    var that = this;

    var scopeOfComputedPropNames = {};
    //console.log('changedPropNames', changedPropNames, this);
    changedPropNames.forEach(function(changedPropName) {
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
  _updateProperties(props) {
    var callback = function(propertyName) {
      return this._updatePropertyIfNeeded(propertyName,
                                          props[propertyName]);
    };

    var changedPropNames = Object.keys(props)
          .filter(callback.bind(this));

    return this._runBatchedEffects(changedPropNames);
  }

  /**
   * Insert to an array
   * - insertItem('tasks',  {id: 2, name: 'asdf'})
   */
  insertItem(propName, item) {
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

    if (existingIndex >= 0) { return null; }

    var itemInstance = this._createInstanceFromValue(propName, item);

    currentList.push(itemInstance);

    var scopeOfPropNames = {};
    scopeOfPropNames[propName] = this._runPropEffects(propName);
    return scopeOfPropNames;
  }

  removeItem(propName, id) {
    var typeArray = this.__config[propName].type;
    if (Array.isArray(typeArray) === false) {
      throw new Error('remove_only_for_arrays');
    }

    var currentList = this[propName];

    if (Array.isArray(currentList) === false) {
      throw new Error('remove_only_from_arrays:' + propName);
    }

    var existingIndex = findIndexById(currentList, id);

    if (existingIndex < 0) { return null; }

    currentList.splice(existingIndex, 1);

    var scopeOfPropNames = {};
    scopeOfPropNames[propName] = this._runPropEffects(propName);
    return scopeOfPropNames;
  }
}

module.exports = Computer;
