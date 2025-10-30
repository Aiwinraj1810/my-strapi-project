const { startOfWeek, endOfWeek, formatISO } = require('date-fns');

module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;

    if (data.assignedDate) {
      const start = startOfWeek(new Date(data.assignedDate), { weekStartsOn: 1 });
      const end = endOfWeek(new Date(data.assignedDate), { weekStartsOn: 1 });
      data.weekStart = formatISO(start, { representation: 'date' });
      data.weekEnd = formatISO(end, { representation: 'date' });
    }
  },

  async beforeUpdate(event) {
    const { data } = event.params;

    if (data.assignedDate) {
      const start = startOfWeek(new Date(data.assignedDate), { weekStartsOn: 1 });
      const end = endOfWeek(new Date(data.assignedDate), { weekStartsOn: 1 });
      data.weekStart = formatISO(start, { representation: 'date' });
      data.weekEnd = formatISO(end, { representation: 'date' });
    }
  },
};
