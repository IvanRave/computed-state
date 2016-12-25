/** @module */

'use strict';

/** A listener of store changes */
class Listener {
  constructor(callback, watchedKeys) {
    this.callback = callback;
    this.watchedKeys = watchedKeys;
  }

  /**
   * Filter and notify listeners
   * If no changedKeys or no watchedKeys - send it
   */
  notify(changedKeys, state, writableState) {
    let isSend = false;
    if (this.watchedKeys && changedKeys) {
      isSend = this.watchedKeys.some(function(watchedKey) {
        return changedKeys.indexOf(watchedKey) >= 0;
      });
    } else {
      isSend = true;
    }

    if (isSend) {
      this.callback(changedKeys, state, writableState);
    }
  }
}

module.exports = Listener;
