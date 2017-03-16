/** @module */

'use strict';

const Effect = require('./effect');

const PRIMARY_KEY = 'id';

const findIndexByPrimaryKey = function(list, primaryKey) {
  for (let i = 0, l = list.length; i < l; i += 1) {
    if (list[i][PRIMARY_KEY] === primaryKey) {
      return i;
    }
  }
  return -1;
};

const findItemByPrimaryKey = function(list, primaryKeyString) {
  return list.filter(function(elem) {
    // country['id'] === 'usa'
    // 'members.5.name' -  typeof '5' === 'string'
    return (elem[PRIMARY_KEY] + '') === primaryKeyString;
  })[0];
};

const hasOwnProperty = function(inst, propName) {
  return {}.hasOwnProperty.call(inst, propName);
};

const pathToLevels = function(propertyPath) {
  return propertyPath.split('.');
};

const levelsToPath = function(levels) {
  return levels.join('.');
};

/** A class to create calculated objects from specific configuration */
class Computer {
  /**
   * @param {Object} settings Common settings for all instances
   */
  constructor(settings) {
    if (!settings) { throw new Error('settings_required'); }

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
    Object.keys(this.__settings)
      .forEach(this._createProperty.bind(this));
  }

  /**
   * Default value for properties: null
   * @param {String} propName Property name, like 'birthDate'
   * @returns {Object} Result of creation
   */
  _createProperty(propName) {
    const propertySetting = this.__settings[propName];

    Object.defineProperty(this, propName, {
      value: propertySetting.type === 'ItemList' ? [] : null,
      writable: true,
      enumerable: true,
      configurable: false
    });

    if (propertySetting.calculate) {
      this._attachComputedProps(propName,
        propertySetting.watchedKeys,
        propertySetting.calculate);
    }
  }

  _attachComputedProps(propName, watchedKeys, calculate) {
    watchedKeys.forEach(this._verifyWatchedKey.bind(this));

    this.__effects.push(new Effect(this,
      propName,
      watchedKeys,
      calculate));
  }

  /**
   * Wached properties must be declared before computed properties
   * @param {String} watchedKey One of ['firstName', 'lastName']
   * @returns {*} Result of verification
   */
  _verifyWatchedKey(watchedKey) {
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
  _createByType(entityConfig, value) {
    // value = { name: 'bar', lname: 'foo', person: { age: 123 } }
    // 1. create 2. update props (with effects)
    const needEntity = new this.constructor(entityConfig);
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
  _createInstanceFromValue(propName, value) {
    if (value === null) { return null; }

    const propSetting = this.__settings[propName];

    // TODO:
    const settingType = propSetting.type;

    // referenced entity, like event.place
    const entitySettings = propSetting.refSettings;

    // console.log('refEntity', refEntity && Object.keys(refEntity));

    const that = this;

    // if (Array.isArray(value)) {
    if (settingType === 'ItemList') {
      if (!entitySettings) {
        throw new Error('required_ref_for_item_list: ' + propName + ' ' + JSON.stringify(value));
      }

      if (Array.isArray(value) === true) {
        return value.map(function(itemValue) {
          return that._createByType(entitySettings, itemValue);
        });
        // throw new Error('required_array: ' + propName + ' ' + JSON.stringify(value));
      }

      // create for insertItem method
      return this._createByType(entitySettings, value);
    } else if (settingType === 'Item') {
      if (!entitySettings) { throw new Error('required_ref_for_item: ' + propName); }
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

  _set(key, value) {
    const propSetting = this.__settings[key];
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
  _setComputed(key, value) {
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
   * @param {*} value To update
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
  _iterateLevels(entityName, nextLevels, value, associatedCommand) {
    const mainEntity = this[entityName];

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
      const elemPrimaryKey = nextLevels[0];
      // search by index of an array
      // it can be replaced with search by id of item
      const mainItem = findItemByPrimaryKey(mainEntity, elemPrimaryKey);

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

    const scopeOfInternalChanges = needEntity[associatedCommand](levelsToPath(needLevels), value);

    if (!scopeOfInternalChanges) { return null; }

    const scopeOfComputedPropNames = {};
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
    const levels = pathToLevels(propertyPath);

    // main = 'student': ['student', 'name'] (object)
    // main = 'lastName': ['lastName'] (property of an object)
    // main = 'people' : ['people', '0', 'name'] (object = array)
    // main = '0' : ['0', 'name'] (object = item of an array)
    const mainLevel = levels[0];
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
    const isChanged = this._updatePropertyIfNeeded(mainLevel, value);
    if (isChanged) { return this._runBatchedEffects([mainLevel]); }
    return null;
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
   * @param {String[]} changedPropNames Like ['name', 'lastName']
   * @returns {Object} Scope of computed property names
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
   * @param {String} propertyPath Like 'groups', 'students',
   *                 'groups.5.members', 'student.grades'
   * @param {Object} item Entity data: { id: 1, name: 'asdf' }
   * @returns {undefined}
   */
  insertItem(propertyPath, item) {
    // TODO: verify id unique through all table
    // TODO: insert, using sorting by id
    if (item[PRIMARY_KEY] === null || item[PRIMARY_KEY] === undefined) {
      throw new Error('required_primary_key_for_prop: ' + PRIMARY_KEY + ': ' + propertyPath);
    }

    // duplication of _updatePath
    const levels = pathToLevels(propertyPath);
    const mainLevel = levels[0];
    if (!mainLevel) {
      throw new Error('property_path_invalid: ' + propertyPath);
    }

    if (levels.length > 1) {
      return this._iterateLevels(mainLevel, levels.slice(1), item, 'insertItem');
      // return null;
    }

    const propertyName = propertyPath; // 1-level

    if (!this.__settings[propertyName]) {
      throw new Error('no_such_property_to_insert: ' + propertyName);
    }

    const propType = this.__settings[propertyName].type;

    if (propType !== 'ItemList') {
      throw new Error('required_ItemList_type_to_insert:' + propertyName);
    }

    var currentList = this[propertyName];

    if (Array.isArray(currentList) === false) {
      throw new Error('required_array_to_insert:' + propertyName);
    }

    var existingIndex = findIndexByPrimaryKey(currentList, item[PRIMARY_KEY]);

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

  removeItem(propertyPath, primaryKeyValue) {
    const levels = pathToLevels(propertyPath);

    if (levels.length > 1) {
      return this._iterateLevels(levels[0], levels.slice(1), primaryKeyValue, 'removeItem');
      // return null;
    }

    const propertyName = propertyPath;

    if (!this.__settings[propertyName]) {
      throw new Error('no_such_property_to_remove: ' + propertyName);
    }

    const propType = this.__settings[propertyName].type;
    // if (Array.isArray(typeArray) === false) {
    if (propType !== 'ItemList') {
      throw new Error('required_ItemList_to_remove: ' + propertyName);
    }

    var currentList = this[propertyName];

    if (Array.isArray(currentList) === false) {
      throw new Error('required_array_value_to_remove:' + propertyName);
    }

    var existingIndex = findIndexByPrimaryKey(currentList, primaryKeyValue);

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
}

module.exports = Computer;
