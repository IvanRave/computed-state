var range = require('./range');

var person = {
  id: { type: Number },
  name: { type: String },
  isValid: {
    type: Boolean,
    computed: ['name', (name) => {
      if (name !== null) { return name.length > 3; }
      return null;
    }]
  }
};

module.exports = {
  people: { type: [person] },
  allNames: {
    type: String,
    computed: ['people', function(people) {
      if (people !== null) {
        return people.map(function(item) {
          return item.name;
        }).join(', ');
      }

      return null;
    }]
  }
};
