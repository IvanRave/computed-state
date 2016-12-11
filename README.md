computed-state
===

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
var state = new Computer(range);
var store = new Store(state);

store.subscribe(function(changedKeys, state) {
      expect(changedKeys).to.deep.equal([
        'start', 'end', 'duration'
      ]);

      expect(state.start).to.equal(15);
      expect(state.end).to.equal(24);
      expect(state.duration).to.equal(9);
      done();
});

store.update({ start: 15, end: 24 });
```

More examples in the 'test' folder.

- no 'undefined' values, only 'null's
- simple separated configuration
- works like Excel / Google sheets

Inspired by [Polymer](https://github.com/Polymer/polymer)