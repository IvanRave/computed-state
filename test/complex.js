var range = require('./range');

module.exports = {
  name: { type: String },
  ageRange: { type: range },
  isNameValid: {
    type: Boolean,
    computed: ['name', (name) => {
      if (name !== null) { return name.length >= 3; }
      return null;
    }]
  },
  isValid: {
    type: Boolean,
    computed: ['isNameValid', 'ageRange', function(isNameValid, ageRange) {
      if (isNameValid !== null &&
          ageRange !== null &&
          ageRange.duration !== null) {
        return ageRange.duration > 50 && isNameValid;
      }

      return null;
    }]
  }
};
