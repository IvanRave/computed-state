/**
 * Creates an internal object from readable settings
 * - async type
 * - computed function + watched keys
 * @todo: precompile these objects from config
 * @module
 */

'use strict';

const areAllArgumentsFilled = function(args) {
  const arr = Array.prototype.slice.call(args);
  return arr.every(function(arg) {
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
const defaultComputedForAsync = function() {
  if (areAllArgumentsFilled(arguments)) {
    return { data: null, error: null, loading: true };
  }

  return null;
};

const buildSettings = function(config) {
  var settings = {};
  Object.keys(config).forEach(function(propName) {
    settings[propName] = new Setting(propName, config[propName]); // eslint-disable-line
  });

  return settings;
};

const attachProps = function(initialSetting, propConfig) {
  const setting = initialSetting;
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

  if (propConfig.isHashMap === true) {
    setting.isHashMap = true;
  }
};

/**
 * Convert from JSON configuration to Setting model
 * all async properties are computed
 * all writable properties can not be async
 * add a default computed function for async properties
 */
class Setting {
  constructor(propName, propConfig) {
    if (!propConfig.type) {
      throw new Error('required_type: ' + propName);
    }

    if (typeof propConfig.type !== 'string') {
      throw new Error('required_prop_type_string: ' + propName);
    }

    // propConfig.label is optional

    const computed = propConfig.computed;
    const computedAsync = propConfig.computedAsync;

    if (computed && computedAsync) {
      throw new Error('use_computed_or_computedAsync: ' + propName);
    }

    if (computedAsync) {
      const innerType = {};
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
    if (!computed && !computedAsync) { return; }

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
  }
}

module.exports = Setting;
