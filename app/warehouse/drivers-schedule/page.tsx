"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Phone,
} from "lucide-react";

type DayStatus = {
  date: string;
  status: "working" | "weekly_off" | "absent";
  reason: string | null;
};

type Driver = {
  id: number;
  name: string;
  phone: string | null;
  city: string;
  weeklyDayOff: string | null;
  workingDays: DayStatus[];
};

type DateInfo = {
  date: string;
  label: string;
  isToday: boolean;
};

export default function DriversSchedulePage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [dates, setDates] = useState<DateInfo[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch("/api/warehouse/drivers/schedule");
      const data = await res.json();
      if (data.success) {
        setDrivers(data.drivers);
        setDates(data.dates);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading)
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-teal-600" />
      </div>
    );

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <Calendar className="h-6 w-6 text-teal-600" />
          جدول السائقين (7 أيام قادمة)
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          من يعمل اليوم، ومن في راحته الأسبوعية، ومن غائب.
        </p>
      </div>

      <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm border border-gray-100 flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="font-bold">يعمل</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-gray-500" />
          <span className="font-bold">راحة أسبوعية</span>
        </div>
        <div className="flex items-center gap-1.5">
          <XCircle className="h-4 w-4 text-red-600" />
          <span className="font-bold">غائب</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-gray-50 text-xs">
            <tr>
              <th className="px-4 py-3 text-right font-bold">السائق</th>
              {dates.map((d, i) => (
                <th
                  key={i}
                  className={`px-2 py-3 text-center font-bold ${
                    d.isToday ? "bg-teal-50 text-teal-700" : ""
                  }`}
                >
                  <div>{d.label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(d.date).toLocaleDateString("ar-MA", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {drivers.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-sm font-black text-teal-700">
                      {d.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900">
                        {d.name}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        📍 {d.city}
                        {d.weeklyDayOff && ` · راحة: ${d.weeklyDayOff}`}
                      </div>
                    </div>
                  </div>
                </td>
                {d.workingDays.map((day, i) => (
                  <td
                    key={i}
                    className={`px-2 py-3 text-center ${
                      dates[i].isToday ? "bg-teal-50" : ""
                    }`}
                  >
                    {day.status === "working" && (
                      <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
                    )}
                    {day.status === "weekly_off" && (
                      <div className="flex flex-col items-center gap-0.5">
                        <Clock className="h-5 w-5 text-gray-400" />
                        <span className="text-[9px] text-gray-500">راحة</span>
                      </div>
                    )}
                    {day.status === "absent" && (
                      <div className="flex flex-col items-center gap-0.5" title={day.reason || ""}>
                        <XCircle className="h-5 w-5 text-red-600" />
                        <span className="text-[9px] text-red-600 truncate max-w-[60px]">
                          {day.reason || "غياب"}
                        </span>
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drivers.length === 0 && (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm mt-4">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">لا يوجد سائقون نشطون</p>
        </div>
      )}
    </div>
  );
}