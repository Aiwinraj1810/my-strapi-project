import { factories } from "@strapi/strapi";
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  isBefore,
  formatISO,
  parseISO,
} from "date-fns";

export default factories.createCoreController("api::timesheet.timesheet", ({ strapi }) => ({
  // ------------------------------------------------
  // 🟢 CREATE — existing logic (unchanged)
  // ------------------------------------------------
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
            sheetStatus: "MISSING",
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

  // ------------------------------------------------
  // 🟡 FULL — new endpoint for full week list + pagination
  // ------------------------------------------------
  /**
   * GET /api/timesheets/full?userId=user123&from=2025-10-01&to=2025-10-31&page=1&pageSize=10
   */
async full(ctx) {
  try {
    const { userId } = ctx.query as { userId?: string };
    if (!userId) return ctx.badRequest("Missing required query param: userId");

    // Extract query params safely
    const { from, to, page, pageSize } = ctx.query as Record<string, string>;

    const pageNumber = Number(page) || 1;
    const sizeNumber = Number(pageSize) || 10;

    // Safely parse dates
    const fromDate = from ? parseISO(String(from)) : startOfWeek(new Date(), { weekStartsOn: 1 });
    const toDate = to ? parseISO(String(to)) : endOfWeek(new Date(), { weekStartsOn: 1 });

    // Generate all weeks in range
    const allWeeks = [];
    let current = startOfWeek(fromDate, { weekStartsOn: 1 });

    while (isBefore(current, toDate) || current.getTime() === toDate.getTime()) {
      const weekStart = formatISO(current, { representation: "date" });
      const weekEnd = formatISO(endOfWeek(current, { weekStartsOn: 1 }), {
        representation: "date",
      });
      allWeeks.push({ weekStart, weekEnd });
      current = addWeeks(current, 1);
    }

    // Fetch existing timesheets
    const existing = await strapi.db.query("api::timesheet.timesheet").findMany({
      where: {
        userId,
        weekStart: { $gte: allWeeks[0].weekStart },
        weekEnd: { $lte: allWeeks[allWeeks.length - 1].weekEnd },
      },
      populate: ["timesheet_entries"],
    });

    // Merge missing + existing
    const merged = allWeeks.map((w) => {
      const match = existing.find((t) => t.weekStart === w.weekStart);
      return (
        match || {
          userId,
          weekStart: w.weekStart,
          weekEnd: w.weekEnd,
          totalHours: 0,
          sheetStatus: "MISSING",
          timesheet_entries: [],
        }
      );
    });

    merged.sort((a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime());

    // ✅ Fixed pagination arithmetic
    const total = merged.length;
    const pageCount = Math.ceil(total / sizeNumber);
    const startIndex = (pageNumber - 1) * sizeNumber;
    const paginated = merged.slice(startIndex, startIndex + sizeNumber);

    const pagination = {
      page: pageNumber,
      pageSize: sizeNumber,
      pageCount,
      total,
    };

    ctx.body = { data: paginated, meta: { pagination } };
  } catch (err) {
    console.error("Error fetching full timesheets:", err);
    ctx.internalServerError("Failed to fetch timesheet data");
  }
}

}));
