export default {
  routes: [
    {
      method: "GET",
      path: "/timesheets/with-missing",
      handler: "timesheet.getWithMissing",
      config: {
        auth: false, // set to true if you want this behind auth
      },
    },
  ],
};
