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
  device: string | null;
  transport: string | null;
  complete_check: boolean;
  csv_check: boolean;
  temp_check: boolean;
  location_check: boolean;
  start_time: string | null;
  stop_time: string | null;
  num_records: number;
};

export default function SubmissionDashboard() {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [transportFilter, setTransportFilter] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (startTime) params.append("startTime", startTime);
      if (endTime) params.append("endTime", endTime);
      if (transportFilter) params.append("transportFilter", transportFilter);

      const queryString = params.toString();
      const url = `https://scpcfumxejgjoknxzxmf.supabase.co/functions/v1/dashboard${queryString ? `?${queryString}` : ""}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const raw = await response.json();
      const normalized: DataPoint[] = raw.map((item: any) => ({
        email: item.email,
        submission_datetime: item.submission_datetime,
        device: item.device ?? null,
        transport: item.transport ?? null,
        complete_check: item.complete === true || item.complete === "TRUE",
        csv_check: item.csv_check === true || item.csv_check === "TRUE",
        temp_check: item.temp_check === true || item.temp_check === "TRUE",
        location_check: item.location_check === true || item.location_check === "TRUE",
        start_time: item.start_time ?? null,
        stop_time: item.stop_time ?? null,
        num_records: typeof item.num_records === "number" ? item.num_records : parseInt(item.num_records || "0"),
      }));

      setData(normalized);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, startTime, endTime, transportFilter]);

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setStartTime("");
    setEndTime("");
    setTransportFilter(null);
  };

  const errorCounts = [
    { name: "Incomplete", value: data.filter((d) => !d.complete_check).length },
    { name: "Missing CSV", value: data.filter((d) => !d.csv_check).length },
    { name: "Missing Temp", value: data.filter((d) => !d.temp_check).length },
    { name: "Missing Location", value: data.filter((d) => !d.location_check).length },
  ];

  return (
    <main className="flex flex-col min-h-screen p-6 max-w-7xl mx-auto space-y-8">
      <h1 className="text-3xl font-semibold text-gray-800">Submissions Dashboard</h1>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Submission Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 text-center text-gray-800">
            <div>
              <p className="text-2xl font-bold">{data.reduce((sum, d) => sum + d.num_records, 0).toLocaleString()}</p>
              <p className="text-sm text-gray-500">Number of Temp Records</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{(
                data.reduce((sum, d) => {
                  const start = d.start_time ? new Date(d.start_time) : null;
                  const stop = d.stop_time ? new Date(d.stop_time) : null;
                  if (!start || !stop || isNaN(start.getTime()) || isNaN(stop.getTime())) return sum;
                  return sum + (stop.getTime() - start.getTime());
                }, 0) / (1000 * 60 * 60)).toLocaleString()}</p>
              <p className="text-sm text-gray-500">Hours of Data</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{new Set(data.map((d) => d.email)).size.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Individual Contributors</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{data.length.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Number of Submissions</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{data.filter((d) => !d.complete_check).length.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Incomplete Submissions</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Filter</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" disabled={loading} />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" disabled={loading} />
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" disabled={loading} />
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" disabled={loading} />
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {["Walking", "Cycling", "Driving", "Other"].map((type) => (
              <button
                key={type}
                onClick={() => setTransportFilter(type === transportFilter ? null : type)}
                className={`px-3 py-1 border rounded text-sm ${transportFilter === type ? "bg-blue-500 text-white" : "bg-gray-100"} ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={loading}
              >
                {type}
              </button>
            ))}
          </div>
          <button onClick={clearFilters} className={`w-full py-2 rounded bg-gray-300 text-sm font-semibold hover:bg-gray-400 transition ${loading ? "opacity-50 cursor-not-allowed" : ""}`} disabled={loading}>
            {loading ? "Loading..." : "Clear Filters"}
          </button>
        </div>
      </section>

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

      <section className="bg-white rounded-lg border border-gray-200 shadow-md p-4 max-h-[400px] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">Latest Submissions</h2>
        {loading && (
          <div className="flex justify-center items-center py-8">
            <div className="text-gray-500">Loading...</div>
          </div>
        )}
        <table className="min-w-full text-sm text-left text-gray-700 border-collapse">
          <thead className="bg-blue-50 sticky top-0 z-10 text-xs uppercase tracking-wide text-gray-600">
            <tr>
              <th className="px-4 py-2 border-b">Email</th>
              <th className="px-4 py-2 border-b">Submitted At</th>
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
                <td className="px-4 py-2 border-b">{row.transport || "—"}</td>
                <td className="px-4 py-2 border-b">{row.complete_check ? "✔️" : "—"}</td>
                <td className="px-4 py-2 border-b">{row.csv_check ? "✔️" : "—"}</td>
                <td className="px-4 py-2 border-b">{row.temp_check ? "✔️" : "—"}</td>
                <td className="px-4 py-2 border-b">{row.location_check ? "✔️" : "—"}</td>
                <td className="px-4 py-2 border-b">{row.start_time ? new Date(row.start_time).toLocaleString() : "—"}</td>
                <td className="px-4 py-2 border-b">{row.stop_time ? new Date(row.stop_time).toLocaleString() : "—"}</td>
                <td className="px-4 py-2 border-b text-right">{row.num_records}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}