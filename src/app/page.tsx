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
  const [filteredData, setFilteredData] = useState<DataPoint[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [transportFilter, setTransportFilter] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/data")
      .then((res) => res.json())
      .then(setData)
      .catch(console.error);
  }, []);

  useEffect(() => {
    let result = [...data];

    if (startDate) {
      const start = new Date(`${startDate}T${startTime || "00:00"}`);
      result = result.filter((d) => new Date(d.submission_datetime) >= start);
    }

    if (endDate) {
      const end = new Date(`${endDate}T${endTime || "23:59"}`);
      result = result.filter((d) => new Date(d.submission_datetime) <= end);
    }

    if (transportFilter) {
      result = result.filter((d) => {
        const t = d.transport.toLowerCase().trim();
        if (transportFilter === "Other") {
          return !["walking", "cycling", "driving", "driving "].includes(t);
        } else {
          return t === transportFilter.toLowerCase();
        }
      });
    }

    setFilteredData(result);
  }, [data, startDate, endDate, startTime, endTime, transportFilter]);

  const errorCounts = [
    { name: "Incomplete", value: filteredData.filter((d) => !d.complete_check).length },
    { name: "Missing CSV", value: filteredData.filter((d) => !d.csv_check).length },
    { name: "Missing Temp", value: filteredData.filter((d) => !d.temp_check).length },
    { name: "Missing Location", value: filteredData.filter((d) => !d.location_check).length },
  ];

  return (
    <main className="flex flex-col min-h-screen p-6 max-w-7xl mx-auto space-y-8">
      <h1 className="text-3xl font-semibold text-gray-800">Submissions Dashboard</h1>

      {/* Submission Overview + Filter */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Submission Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 text-center text-gray-800">
            <div>
              <p className="text-2xl font-bold">
                {filteredData.reduce((sum, d) => sum + d.num_records, 0).toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">Number of Temp Records</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {Math.floor(
                  filteredData.reduce((sum, d) => {
                    const start = new Date(d.start_time);
                    const stop = new Date(d.stop_time);
                    if (isNaN(start.getTime()) || isNaN(stop.getTime())) return sum;
                    return sum + (stop.getTime() - start.getTime());
                  }, 0) / (1000 * 60 * 60)
                ).toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">Hours of Data</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {new Set(filteredData.map((d) => d.email)).size.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">Individual Contributors</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{filteredData.length.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Number of Submissions</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {filteredData.filter((d) => !d.complete_check).length.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">Incomplete Submissions</p>
            </div>
          </div>
        </div>

        {/* Filter Panel */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Filter</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" />
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" />
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" />
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {["Walking", "Cycling", "Driving", "Other"].map((type) => (
              <button
                key={type}
                onClick={() => setTransportFilter(type === transportFilter ? null : type)}
                className={`px-3 py-1 border rounded text-sm ${
                  transportFilter === type ? "bg-blue-500 text-white" : "bg-gray-100"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          <button onClick={() => {
            setStartDate("");
            setEndDate("");
            setStartTime("");
            setEndTime("");
            setTransportFilter(null);
          }} className="w-full py-2 rounded bg-gray-300 text-sm font-semibold hover:bg-gray-400 transition">
            Clear Filters
          </button>
        </div>
      </section>

      {/* Error Bar Chart */}
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

      {/* Table Section */}
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
            {filteredData.map((row, idx) => (
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
