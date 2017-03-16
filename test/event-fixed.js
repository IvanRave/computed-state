var extend = require('extend');
var event = require('./event');
var moment = require('moment');

var eventFixed = {};

extend(eventFixed, event, {
  /** Some fixed duration, like max duration of the event */
  durationFixed: {
    type: 'Duration'
  },

  endDateFixed: {
    type: 'Date',
    computed: ['startDate', 'durationFixed', function(startDate, durationFixed) {
      if (startDate === null || durationFixed === null) {
        return null;
      }

      var mmDuration = moment.duration(durationFixed);
      var mmEndDate = moment(startDate).add(mmDuration);

      return mmEndDate.format('YYYY-MM-DD');
    }]
  }
});

module.exports = eventFixed;
