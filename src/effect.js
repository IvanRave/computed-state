/** @module */

/** An effect for some computed property */
class Effect {
  constructor(ctx, computedKey, watchedKeys, computation) {
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
  compute(changedKey) {
    if (this.watchedKeys.indexOf(changedKey) < 0) { return null; }

    var ctx = this.ctx;

    var args = this.watchedKeys.map(function(watchedKey) {
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
}

module.exports = Effect;
