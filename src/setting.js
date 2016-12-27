/** @module */

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
 * Async properteis contains only computedAsync definition
 * There is a default function to compute initial values for async properties (null values for data and error)
 */
const defaultComputedForAsync = function() {
  if (areAllArgumentsFilled(arguments)) {
    return { data: null, error: null, loading: true };
  }

  return null;
};

/** Async wrapper for initial types */
const defaultTypeForAsync = function(initialType) {
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
class Setting {
  constructor(propName, propConfig) {
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
