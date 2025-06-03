"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
} from "recharts";

type DataPoint = {
  email: string;
  submission_datetime: string;
  device: string;
  transport: string;
  complete_check: boolean;
  csv_check: boolean;
  temp_check: boolean;
  location_check: boolean;
  start_time: string;
  stop_time: string;
  num_records: number;
};

export default function HomePage() {
  const [data, setData] = useState<DataPoint[]>([]);

  useEffect(() => {
    fetch("/api/data")
      .then((res) => res.json())
      .then(setData)
      .catch(console.error);
  }, []);

  const errorCounts = [
    { name: "Incomplete", value: data.filter((d) => !d.complete_check).length },
    { name: "Missing CSV", value: data.filter((d) => !d.csv_check).length },
    { name: "Missing Temp", value: data.filter((d) => !d.temp_check).length },
    { name: "Missing Location", value: data.filter((d) => !d.location_check).length },
  ];

  return (
    <main className="flex flex-col min-h-screen p-6 max-w-7xl mx-auto space-y-8">
      <h1 className="text-3xl font-semibold text-gray-800">📊 Submissions Dashboard</h1>

      {/* Error summary bar chart */}
      <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 text-gray-700">
        <h2 className="text-lg font-semibold mb-4">Common Submission Errors</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart layout="vertical" data={errorCounts} margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="name" />
            <Tooltip />
            <Bar dataKey="value" fill="#f87171">
              <LabelList dataKey="value" position="right" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Scrollable table section */}
      <section className="bg-white rounded-lg border border-gray-200 shadow-md p-4 max-h-[400px] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">Latest Submissions</h2>
        <table className="min-w-full text-sm text-left text-gray-700 border-collapse">
          <thead className="bg-blue-50 sticky top-0 z-10 text-xs uppercase tracking-wide text-gray-600">
            <tr>
              <th className="px-4 py-2 border-b">Email</th>
              <th className="px-4 py-2 border-b">Submitted At</th>
              <th className="px-4 py-2 border-b">Device</th>
              <th className="px-4 py-2 border-b">Transport</th>
              <th className="px-4 py-2 border-b">Complete</th>
              <th className="px-4 py-2 border-b">CSV</th>
              <th className="px-4 py-2 border-b">Temp</th>
              <th className="px-4 py-2 border-b">Location</th>
              <th className="px-4 py-2 border-b">Start Time</th>
              <th className="px-4 py-2 border-b">Stop Time</th>
              <th className="px-4 py-2 border-b text-right">Records</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx} className="even:bg-gray-50 hover:bg-gray-100 transition-colors duration-100">
                <td className="px-4 py-2 border-b">{row.email}</td>
                <td className="px-4 py-2 border-b">{new Date(row.submission_datetime).toLocaleString()}</td>
                <td className="px-4 py-2 border-b">{row.device}</td>
                <td className="px-4 py-2 border-b">{row.transport}</td>
                <td className="px-4 py-2 border-b">{row.complete_check ? "✔️" : "—"}</td>
                <td className="px-4 py-2 border-b">{row.csv_check ? "✔️" : "—"}</td>
                <td className="px-4 py-2 border-b">{row.temp_check ? "✔️" : "—"}</td>
                <td className="px-4 py-2 border-b">{row.location_check ? "✔️" : "—"}</td>
                <td className="px-4 py-2 border-b">{new Date(row.start_time).toLocaleString()}</td>
                <td className="px-4 py-2 border-b">{new Date(row.stop_time).toLocaleString()}</td>
                <td className="px-4 py-2 border-b text-right">{row.num_records}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
