export default {
  routes: [
    {
      method: "GET",
      path: "/timesheets/full",
      handler: "timesheet.full", // 👈 points to your custom controller method
      config: {
        auth: false, // or true if you want to restrict access
      },
    },
  ],
};
