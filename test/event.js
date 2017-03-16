var moment = require('moment');

var fromYmdToDuration = function(ymd) {
  var str = 'P';
  if (ymd.years) { str += ymd.years + 'Y'; }
  if (ymd.months) { str += ymd.months + 'M'; }
  if (ymd.days) { str += ymd.days + 'D'; }
  return str;
};

/** http://schema.org/Event */
module.exports = {
  name: { type: 'Text' },
  startDate: { type: 'Date' },
  endDate: { type: 'Date' },
  /** like a calculateDuration() method */
  duration: {
    type: 'Duration',
    computed: ['startDate', 'endDate', function(startDate, endDate) {
      if (startDate === null || endDate === null) { return null; }

      var start = moment(startDate);
      var end = moment(endDate);

      var fullMonths = end.diff(start, 'months');
      end.subtract(fullMonths, 'months');

      var ymd = {
        years: parseInt(fullMonths / 12, 10),
        months: fullMonths % 12,
        days: end.diff(start, 'days')
      };

      return fromYmdToDuration(ymd);
    }]
  }
};
