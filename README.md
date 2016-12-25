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


Inspired by [Polymer](https://github.com/Polymer/polymer)