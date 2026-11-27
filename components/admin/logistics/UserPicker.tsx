"use client";
import { useState } from "react";
import { api, inputCls } from "./ui";
import type { UserHit } from "./types";

export default function UserPicker({
  value,
  onChange,
}: {
  value: UserHit | null;
  onChange: (u: UserHit | null) => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<UserHit[]>([]);

  async function search(v: string) {
    setQ(v);
    if (v.trim().length < 2) {
      setHits([]);
      return;
    }
    const r = await api("/api/admin/logistics/users?q=" + encodeURIComponent(v.trim()));
    if (r.ok) setHits(r.json.users as UserHit[]);
  }

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm">
        <span className="font-bold">
          {value.name || "—"} <span className="text-xs text-gray-500" dir="ltr">{value.phone || ""}</span>
        </span>
        <button type="button" className="text-xs font-bold text-red-600" onClick={() => onChange(null)}>
          تغيير
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <input
        className={inputCls}
        placeholder="ابحث بالاسم أو الهاتف (حرفان على الأقل)"
        value={q}
        onChange={(e) => void search(e.target.value)}
      />
      {hits.length > 0 && (
        <ul className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white">
          {hits.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-right text-sm hover:bg-gray-50"
                onClick={() => {
                  onChange(u);
                  setHits([]);
                  setQ("");
                }}
              >
                <span className="font-bold">{u.name || "—"}</span>
                <span className="text-xs text-gray-500" dir="ltr">{u.phone || ""} · {u.role}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}