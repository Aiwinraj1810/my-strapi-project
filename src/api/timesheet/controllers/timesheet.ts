import { factories } from "@strapi/strapi";
import { startOfWeek, endOfWeek, formatISO } from "date-fns";

export default factories.createCoreController("api::timesheet.timesheet", ({ strapi }) => ({
  async create(ctx) {
    try {
      const {
        userId,
        project,
        typeOfWork,
        description,
        hours,
        assignedDate,
      } = ctx.request.body.data;

      if (!userId || !assignedDate) {
        return ctx.badRequest("Missing required fields: userId or assignedDate");
      }

      // Calculate week boundaries
      const start = startOfWeek(new Date(assignedDate), { weekStartsOn: 1 });
      const end = endOfWeek(new Date(assignedDate), { weekStartsOn: 1 });
      const weekStart = formatISO(start, { representation: "date" });
      const weekEnd = formatISO(end, { representation: "date" });

      // 1️⃣ Find or create a Timesheet for this user/week
      let timesheet = await strapi.db.query("api::timesheet.timesheet").findOne({
        where: { userId, weekStart },
      });

      if (!timesheet) {
        timesheet = await strapi.db.query("api::timesheet.timesheet").create({
          data: {
            userId,
            weekStart,
            weekEnd,
            totalHours: 0,
            status: "MISSING",
          },
        });
      }

      // 2️⃣ Create new entry linked to this timesheet
      await strapi.db.query("api::timesheet-entry.timesheet-entry").create({
        data: {
          timesheet: timesheet.id,
          project,
          typeOfWork,
          description,
          hours,
          assignedDate,
          weekStart,
          weekEnd,
        },
      });

      // 3️⃣ Recalculate total hours & update status
      const entries = await strapi.db.query("api::timesheet-entry.timesheet-entry").findMany({
        where: { timesheet: timesheet.id },
      });

      const totalHours = entries.reduce((acc, e) => acc + e.hours, 0);

      let status = "MISSING";
      if (totalHours >= 40) status = "COMPLETED";
      else if (totalHours > 0) status = "INCOMPLETE";

      await strapi.db.query("api::timesheet.timesheet").update({
        where: { id: timesheet.id },
        data: { totalHours, sheetStatus: status },
      });

      ctx.body = { message: "Timesheet updated", timesheet };
    } catch (err) {
      console.error("Error creating timesheet:", err);
      ctx.internalServerError("Failed to create timesheet entry");
    }
  },
}));
