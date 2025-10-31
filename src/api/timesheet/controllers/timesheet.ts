import { factories } from "@strapi/strapi";
import {
  eachWeekOfInterval,
  getISOWeek,
  addDays,
  format,
  startOfWeek,
  endOfWeek,
  formatISO,
  startOfYear,
  endOfYear,
} from "date-fns";

export default factories.createCoreController(
  "api::timesheet.timesheet",
  ({ strapi }) => ({
    // ✅ Your existing "create" logic
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
          return ctx.badRequest(
            "Missing required fields: userId or assignedDate"
          );
        }

        const start = startOfWeek(new Date(assignedDate), { weekStartsOn: 1 });
        const end = endOfWeek(new Date(assignedDate), { weekStartsOn: 1 });
        const weekStart = formatISO(start, { representation: "date" });
        const weekEnd = formatISO(end, { representation: "date" });

        let timesheet = await strapi.db
          .query("api::timesheet.timesheet")
          .findOne({
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

        const entries = await strapi.db
          .query("api::timesheet-entry.timesheet-entry")
          .findMany({
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

    // ✅ New route: GET /api/timesheets/with-missing
    async getWithMissing(ctx) {
      try {
        // ✅ Safely cast query
        const query = ctx.query as Record<string, any>;

        // ✅ Read filter params
        const startFilter = query["filters[weekStart][$gte]"];
        const endFilter = query["filters[weekEnd][$lte]"];
        const from = startFilter
          ? new Date(startFilter)
          : new Date("2025-01-01");
        const to = endFilter ? new Date(endFilter) : new Date("2025-12-31");

        // ✅ Pagination fix
        const pagination = (query.pagination || {}) as Record<string, any>;
        const page = parseInt(query.page || pagination.page || "1", 10);
        const pageSize = parseInt(
          query.pageSize || pagination.pageSize || "10",
          10
        );

        const userId = query.userId as string | undefined;
        const status = query.status as string | undefined;

        // 1️⃣ Fetch existing timesheets
        const where: any = {
          weekStart: { $gte: from, $lte: to },
        };
        if (userId) where.userId = userId;
        if (status) where.sheetStatus = status;

        const existing = await strapi.db
          .query("api::timesheet.timesheet")
          .findMany({
            where,
            orderBy: { weekStart: "asc" },
          });

        // 2️⃣ Build lookup map
        const existingMap = new Map(
          existing.map((t) => [format(new Date(t.weekStart), "yyyy-MM-dd"), t])
        );

        // 3️⃣ Generate all weeks
        const allWeeks = eachWeekOfInterval({ start: from, end: to });
        const allWeekData = allWeeks.map((weekStartDate) => {
          const weekStart = format(weekStartDate, "yyyy-MM-dd");
          const weekEnd = format(addDays(weekStartDate, 6), "yyyy-MM-dd");
          const week = getISOWeek(weekStartDate);
          const existing = existingMap.get(weekStart);

          return existing
            ? {
                id: existing.id,
                week,
                weekStart,
                weekEnd,
                sheetStatus: existing.sheetStatus,
                totalHours: existing.totalHours,
                userId: existing.userId,
              }
            : {
                id: `missing-${weekStart}`,
                week,
                weekStart,
                weekEnd,
                sheetStatus: "MISSING",
                totalHours: 0,
              };
        });

        // 4️⃣ Paginate result
        const total = allWeekData.length;
        const startIdx = (page - 1) * pageSize;
        const paged = allWeekData.slice(startIdx, startIdx + pageSize);

        ctx.body = {
          data: paged,
          meta: {
            pagination: {
              page,
              pageSize,
              pageCount: Math.ceil(total / pageSize),
              total,
            },
          },
        };
      } catch (err) {
        console.error("❌ Error in getWithMissing:", err);
        ctx.throw(500, "Failed to generate weekly data");
      }
    },
  })
);
