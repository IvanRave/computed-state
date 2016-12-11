var extend = require('extend');
var range = require('./range');

var rangeFixed = {};

extend(rangeFixed, range, {
  durationFixed: { type: Number },
  endFixed: {
    type: Number,
    computed: ['start', 'durationFixed', (a, b) => {
      if (a !== null && b !== null) {
        return a + b;
      }
      return null;
    }]
  }
});

module.exports = rangeFixed;
