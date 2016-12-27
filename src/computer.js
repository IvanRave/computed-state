/** @module */

'use strict';

const Effect = require('./effect');
const Setting = require('./setting');

const PRIMARY_KEY = 'id';

const findIndexByPrimaryKey = function(list, primaryKey) {
  for (let i = 0, l = list.length; i < l; i += 1) {
    if (list[i][PRIMARY_KEY] === primaryKey) {
      return i;
    }
  }
  return -1;
};

const hasOwnProperty = function(inst, propName) {
  return {}.hasOwnProperty.call(inst, propName);
};

const extendConfig = function(config) {
  var result = {};
  Object.keys(config).forEach(function(propName) {
    result[propName] = new Setting(propName, config[propName]);
  });
  return result;
};


/** A class to create calculated objects from specific configuration */
class Computer {
  /**
   * @param {Object} config Common config for all instances
   */
  constructor(config, initialProps) {
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
  _createProperty(propName) {
    const propSettings = this.__config[propName];

    Object.defineProperty(this, propName, {
      value: Array.isArray(propSettings.type) ? [] : null,
      writable: true,
      enumerable: true,
      configurable: false
    });

    if (propSettings.calculate) {
      this._attachComputedProps(propName,
                                propSettings.watchedKeys,
                                propSettings.calculate);
    }
  }

  _attachComputedProps(propName, watchedKeys, calculate) {
    watchedKeys.forEach(this._verifyWatchedKey.bind(this));

    this.__effects.push(new Effect(this,
                                   propName,
                                   watchedKeys,
                                   calculate));
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
  _createInstanceFromValue(propName, value) {
    if (value === null) { return null; }
    const settingType = this.__config[propName].type;
    const PropConfigType = Array.isArray(settingType) ?
          settingType[0] : settingType;

    const that = this;
    if (Array.isArray(value)) {
      return value.map(function(itemValue) {
        return that._createByType(PropConfigType, itemValue);
      });
    }

    return this._createByType(PropConfigType, value);
  }

  _set(key, value) {
    var keyConfig = this.__config[key];
    if (keyConfig.calculate &&
       !keyConfig.calculateAsync) {
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
  _setComputed(key, value) {
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
  _shouldPropChange(propertyName, value) {
    if (value === undefined) {
      throw new Error('value_cannot_be_undefined');
    }

    const old = this[propertyName];
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

    const valueInstance = this._createInstanceFromValue(propertyName, value);
    this._setComputed(propertyName, valueInstance);
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

    const valueInstance = this._createInstanceFromValue(propertyName, value);
    this._set(propertyName, valueInstance);
    return true;
  }

  _runPropEffects(changedPropName) {
    const list = [];
    this.__effects.forEach(function(eff) {
      const scopeOfComputedPropNames = eff.compute(changedPropName);
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
  _updatePathObject(objectName, nextParts, value) {
    const mainObject = this[objectName];

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
      var mainItem = mainObject.filter(function(elem) {
        // country['id'] === 'usa'
        return (elem[PRIMARY_KEY] + '') === elemPrimaryKey;
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
  _updatePath(propertyPath, value) {
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
    // console.log('changedPropNames', changedPropNames, this);
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

    if (existingIndex >= 0) { return null; }

    var itemInstance = this._createInstanceFromValue(propName, item);

    currentList.push(itemInstance);

    var scopeOfPropNames = {};
    scopeOfPropNames[propName] = this._runPropEffects(propName);
    return scopeOfPropNames;
  }

  removeItem(propName, primaryKey) {
    var typeArray = this.__config[propName].type;
    if (Array.isArray(typeArray) === false) {
      throw new Error('remove_only_for_arrays');
    }

    var currentList = this[propName];

    if (Array.isArray(currentList) === false) {
      throw new Error('remove_only_from_arrays:' + propName);
    }

    var existingIndex = findIndexByPrimaryKey(currentList, primaryKey);

    if (existingIndex < 0) { return null; }

    currentList.splice(existingIndex, 1);

    var scopeOfPropNames = {};
    scopeOfPropNames[propName] = this._runPropEffects(propName);
    return scopeOfPropNames;
  }
}

module.exports = Computer;
