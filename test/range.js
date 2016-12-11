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
