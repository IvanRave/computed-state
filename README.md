computed-state
===

[![Build Status](https://travis-ci.org/IvanRave/computed-state.svg?branch=master)](https://travis-ci.org/IvanRave/computed-state)

Observable computed state

```
// range.js
module.exports = {
  start: { type: Number },
  end: { type: Number },
  duration: {
    type: Number,
    computed: ['start', 'end', function(start, end) {
      if (start !== null && end !== null) { return end - start; }
      return null;
    }]
  }
};
```

```
// main.js
var state = new ComputedState(range);

state.subscribe(function(changedKeys, stateNew) {
      expect(changedKeys).to.deep.equal([
        'start', 'end', 'duration'
      ]);

      expect(stateNew.start).to.equal(15);
      expect(stateNew.end).to.equal(24);
      expect(stateNew.duration).to.equal(9);
      done();
});

state.update({ start: 15, end: 24 });
```

More examples in the 'test' folder.

- no 'undefined' values, only 'null's
- simple separated configuration
- works like Excel / Google sheets


Operations with state
---

DB:UPDATE
```
state.update({
    bar: 'foo', // simple property
    'student.name': 'John', // a property of internal object
    'countries.usa.area': 123 // array with item: id = 'usa'
})
```

DB:INSERT
```state.insertItem('countries', { id: 'usa', name: 'USA' }```

DB:DELETE
```state.removeItem('countries', 'usa');```

DB:TRIGGER
```
var callback = function(changedKeys, stateNew) { };
state.subscribe(callback, ['watchedKeys']);
```

Async properties
---

Usage:

- Load external data, like XHR ajax requests
- Timeouts
- Promises
- DOM manipulation
- etc.

```
module.exports = {
  // simple writable property
  endpoint: { type: String },
  // async computed property
  weather: {
    type: Number,
    computedAsync: ['endpoint', function(endpoint, resolve, reject) {
      if (endpoint === null) { return null; }
      // update externally
      var timeoutInstance = setTimeout(function() {
        var demoWeather = 32;
        resolve(demoWeather);
        // reject('error message or code');
      }, 500);

      // return a function that cancels this timeout
      return clearTimeout.bind(null, timeoutInstance);
    }]
  },
  // a computed property, based on 'weather' async property
  weatherMessage: {
    type: String,
    computed: ['weather', function(weatherAsync) {
      if (weatherAsync === null || weatherAsync.data === null) {
         return null;
      }
      return 'The weather is ' + weatherAsync.data;
    }]
  }
```

How async works:

- a user updates 'endpoint' = 'someUrl'

Sync computation:

- recalculates 'weather': set to null
- recalculates 'weatherMessage': set to null

Async computation:

- runs async 'weather' calculation (automatically)
- recalculates 'weather': set to { data: 32, error: null }
- recalculates 'weatherMessage': set to 'The weather is 32'


Inspired by:
---

- Google Sheets
- [Polymer](https://www.polymer-project.org/1.0/docs/devguide/observers)
- [Knockout](https://github.com/knockout/knockout/wiki/asynchronous-dependent-observables)