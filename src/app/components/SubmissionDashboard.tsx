"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
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
import { Search, Filter, X, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

type DataPoint = {
  email: string;
  submission_datetime: string;
  device: string | null;
  transport: string | null;
  complete: boolean;
  csv_check: boolean;
  temp_check: boolean;
  location_check: boolean;
  start_time: string | null;
  stop_time: string | null;
  num_records: number;
};

type SortConfig = {
  key: keyof DataPoint | 'duration';
  direction: 'asc' | 'desc';
};

export default function SubmissionDashboard() {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  
  // Server-side filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [transportFilter, setTransportFilter] = useState<string | null>(null);
  const [completionFilter, setCompletionFilter] = useState<string | null>(null);
  const [emailFilter, setEmailFilter] = useState("");
  const [minRecords, setMinRecords] = useState("");
  const [maxRecords, setMaxRecords] = useState("");
  const [dataStartDate, setDataStartDate] = useState("");
  const [dataEndDate, setDataEndDate] = useState("");
  const [dataStartTime, setDataStartTime] = useState("");
  const [dataEndTime, setDataEndTime] = useState("");
  const [validationFilters, setValidationFilters] = useState({
    csv: null as string | null,
    temp: null as string | null,
    location: null as string | null
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (startTime) params.append("startTime", startTime);
      if (endTime) params.append("endTime", endTime);
      if (transportFilter) params.append("transportFilter", transportFilter);
      if (completionFilter) params.append("completionStatus", completionFilter);
      if (emailFilter) params.append("emailSearch", emailFilter);
      if (minRecords) params.append("minRecords", minRecords);
      if (maxRecords) params.append("maxRecords", maxRecords);
      if (dataStartDate) params.append("dataStartDate", dataStartDate);
      if (dataEndDate) params.append("dataEndDate", dataEndDate);
      if (dataStartTime) params.append("dataStartTime", dataStartTime);
      if (dataEndTime) params.append("dataEndTime", dataEndTime);
      if (validationFilters.csv) params.append("hasCSV", validationFilters.csv);
      if (validationFilters.temp) params.append("hasTemp", validationFilters.temp);
      if (validationFilters.location) params.append("hasLocation", validationFilters.location);

      const queryString = params.toString();
      const url = `https://scpcfumxejgjoknxzxmf.supabase.co/functions/v1/dashboard${queryString ? `?${queryString}` : ""}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, startTime, endTime, transportFilter, completionFilter, emailFilter, minRecords, maxRecords, dataStartDate, dataEndDate, dataStartTime, dataEndTime, validationFilters]);

  // Load initial data only once on component mount
  useEffect(() => {
    fetchData();
  }, []); // Empty dependency array - only runs once on mount

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setStartTime("");
    setEndTime("");
    setTransportFilter(null);
    setCompletionFilter(null);
    setEmailFilter("");
    setMinRecords("");
    setMaxRecords("");
    setDataStartDate("");
    setDataEndDate("");
    setDataStartTime("");
    setDataEndTime("");
    setValidationFilters({ csv: null, temp: null, location: null });
    setSearchTerm("");
    setSortConfig(null);
  };

  // Only call fetchData when user clicks "Apply Changes"
  const applyFilters = () => {
    fetchData();
  };

  // Client-side filtering and sorting
  const filteredAndSortedData = useMemo(() => {
    const filtered = data.filter((item) => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        item.email.toLowerCase().includes(search) ||
        (item.transport?.toLowerCase() || "").includes(search) ||
        (item.device?.toLowerCase() || "").includes(search) ||
        item.submission_datetime.toLowerCase().includes(search)
      );
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue: string | number;
        let bValue: string | number;

        if (sortConfig.key === 'duration') {
          const aStart = a.start_time ? new Date(a.start_time) : null;
          const aStop = a.stop_time ? new Date(a.stop_time) : null;
          const bStart = b.start_time ? new Date(b.start_time) : null;
          const bStop = b.stop_time ? new Date(b.stop_time) : null;
          
          aValue = aStart && aStop ? aStop.getTime() - aStart.getTime() : 0;
          bValue = bStart && bStop ? bStop.getTime() - bStart.getTime() : 0;
        } else {
          aValue = a[sortConfig.key] as string | number;
          bValue = b[sortConfig.key] as string | number;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data, searchTerm, sortConfig]);

  const handleSort = (key: keyof DataPoint | 'duration') => {
    setSortConfig(current => {
      if (current?.key === key) {
        return current.direction === 'asc' 
          ? { key, direction: 'desc' }
          : null;
      }
      return { key, direction: 'asc' };
    });
  };

  const getSortIcon = (key: keyof DataPoint | 'duration') => {
    if (sortConfig?.key !== key) return null;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const totalRecords = filteredAndSortedData.reduce((sum, d) => sum + d.num_records, 0);
    const totalHours = filteredAndSortedData.reduce((sum, d) => {
      const start = d.start_time ? new Date(d.start_time) : null;
      const stop = d.stop_time ? new Date(d.stop_time) : null;
      if (!start || !stop || isNaN(start.getTime()) || isNaN(stop.getTime())) return sum;
      return sum + (stop.getTime() - start.getTime());
    }, 0) / (1000 * 60 * 60);
    
    const uniqueContributors = new Set(filteredAndSortedData.map(d => d.email)).size;
    const totalSubmissions = filteredAndSortedData.length;
    const incompleteSubmissions = filteredAndSortedData.filter(d => !d.complete).length;

    return { totalRecords, totalHours, uniqueContributors, totalSubmissions, incompleteSubmissions };
  }, [filteredAndSortedData]);

  const errorCounts = useMemo(() => [
    { name: "Incomplete", value: filteredAndSortedData.filter((d) => !d.complete).length },
    { name: "Missing CSV", value: filteredAndSortedData.filter((d) => !d.csv_check).length },
    { name: "Missing Temp", value: filteredAndSortedData.filter((d) => !d.temp_check).length },
    { name: "Missing Location", value: filteredAndSortedData.filter((d) => !d.location_check).length },
  ], [filteredAndSortedData]);

  return (
    <main className="flex flex-col min-h-screen p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-semibold text-gray-800">Submissions Dashboard</h1>
        <div className="text-sm text-gray-600">
          Showing {filteredAndSortedData.length} of {data.length} submissions
        </div>
      </div>

      {/* Statistics Overview */}
      <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-center text-gray-800">
          <div className="min-w-[100px]">
            <p className="text-xl font-bold break-words">{stats.totalRecords.toLocaleString()}</p>
            <p className="text-xs text-gray-500 leading-tight">Temperature Records</p>
          </div>
          <div className="min-w-[100px]">
            <p className="text-xl font-bold break-words">
              {stats.totalHours.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </p>
            <p className="text-xs text-gray-500 leading-tight">Hours of Data</p>
          </div>
          <div className="min-w-[100px]">
            <p className="text-xl font-bold">{stats.uniqueContributors.toLocaleString()}</p>
            <p className="text-xs text-gray-500 leading-tight">Contributors</p>
          </div>
          <div className="min-w-[100px]">
            <p className="text-xl font-bold">{stats.totalSubmissions.toLocaleString()}</p>
            <p className="text-xs text-gray-500 leading-tight">Submissions</p>
          </div>
          <div className="min-w-[100px]">
            <p className="text-xl font-bold text-red-600">{stats.incompleteSubmissions.toLocaleString()}</p>
            <p className="text-xs text-gray-500 leading-tight">Issues</p>
          </div>
        </div>
      </section>

      {/* Filters Section */}
      <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Filters</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="flex items-center gap-2 px-3 py-1 text-sm border rounded hover:bg-gray-50"
            >
              <Filter className="w-4 h-4" />
              Advanced
            </button>
            <button
              onClick={applyFilters}
              className="flex items-center gap-2 px-4 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Apply Changes
            </button>
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
              disabled={loading}
            >
              <X className="w-4 h-4" />
              Clear All
            </button>
          </div>
        </div>

        {/* Quick Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search submissions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
            />
          </div>
          
          <div className="flex gap-2">
            {["Walking", "Cycling", "Driving", "Other"].map((type) => (
              <button
                key={type}
                onClick={() => setTransportFilter(type === transportFilter ? null : type)}
                className={`px-3 py-2 border rounded text-sm ${
                  transportFilter === type ? "bg-blue-500 text-white" : "bg-gray-100 hover:bg-gray-200"
                } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={loading}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {[
              { key: "complete", label: "Complete" },
              { key: "incomplete", label: "Issues" }
            ].map((status) => (
              <button
                key={status.key}
                onClick={() => setCompletionFilter(status.key === completionFilter ? null : status.key)}
                className={`px-3 py-2 border rounded text-sm ${
                  completionFilter === status.key 
                    ? status.key === "complete" ? "bg-green-500 text-white" : "bg-red-500 text-white"
                    : "bg-gray-100 hover:bg-gray-200"
                } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={loading}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="border-t pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Submission Date Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                    disabled={loading}
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Submission Time Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                    disabled={loading}
                    step="1"
                  />
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                    disabled={loading}
                    step="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Data Collection Date Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={dataStartDate}
                    onChange={(e) => setDataStartDate(e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                    disabled={loading}
                  />
                  <input
                    type="date"
                    value={dataEndDate}
                    onChange={(e) => setDataEndDate(e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Data Collection Time Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    value={dataStartTime}
                    onChange={(e) => setDataStartTime(e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                    disabled={loading}
                    step="1"
                  />
                  <input
                    type="time"
                    value={dataEndTime}
                    onChange={(e) => setDataEndTime(e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                    disabled={loading}
                    step="1"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Record Count</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={minRecords}
                    onChange={(e) => setMinRecords(e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                    disabled={loading}
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxRecords}
                    onChange={(e) => setMaxRecords(e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email Filter</label>
                <input
                  type="text"
                  placeholder="Filter by email..."
                  value={emailFilter}
                  onChange={(e) => setEmailFilter(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Validation Checks</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { key: "csv", label: "CSV File" },
                  { key: "temp", label: "Temperature Data" },
                  { key: "location", label: "Location Data" }
                ].map((check) => (
                  <div key={check.key} className="flex gap-2">
                    <button
                      onClick={() => setValidationFilters(prev => ({
                        ...prev,
                        [check.key]: prev[check.key as keyof typeof prev] === "true" ? null : "true"
                      }))}
                      className={`px-3 py-1 border rounded text-sm ${
                        validationFilters[check.key as keyof typeof validationFilters] === "true"
                          ? "bg-green-500 text-white" : "bg-gray-100"
                      }`}
                    >
                      Has {check.label}
                    </button>
                    <button
                      onClick={() => setValidationFilters(prev => ({
                        ...prev,
                        [check.key]: prev[check.key as keyof typeof prev] === "false" ? null : "false"
                      }))}
                      className={`px-3 py-1 border rounded text-sm ${
                        validationFilters[check.key as keyof typeof validationFilters] === "false"
                          ? "bg-red-500 text-white" : "bg-gray-100"
                      }`}
                    >
                      Missing {check.label}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Error Chart */}
      <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">Submission Issues</h2>
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

      {/* Submissions Table */}
      <section className="bg-white rounded-lg border border-gray-200 shadow-md">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Submissions</h2>
        </div>
        
        <div className="max-h-[500px] overflow-auto">
          {loading ? (
            <div className="flex justify-center items-center py-8 text-gray-500">Loading...</div>
          ) : (
            <table className="min-w-full text-sm text-left text-gray-700">
              <thead className="bg-blue-50 sticky top-0 z-10 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th 
                    className="px-4 py-3 border-b cursor-pointer hover:bg-blue-100 select-none"
                    onClick={() => handleSort('email')}
                  >
                    <div className="flex items-center gap-1">
                      Email
                      {getSortIcon('email')}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 border-b cursor-pointer hover:bg-blue-100 select-none"
                    onClick={() => handleSort('submission_datetime')}
                  >
                    <div className="flex items-center gap-1">
                      Submitted
                      {getSortIcon('submission_datetime')}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 border-b cursor-pointer hover:bg-blue-100 select-none"
                    onClick={() => handleSort('transport')}
                  >
                    <div className="flex items-center gap-1">
                      Transport
                      {getSortIcon('transport')}
                    </div>
                  </th>
                  <th className="px-4 py-3 border-b">Complete</th>
                  <th className="px-4 py-3 border-b">CSV</th>
                  <th className="px-4 py-3 border-b">Temp</th>
                  <th className="px-4 py-3 border-b">Location</th>
                  <th 
                    className="px-4 py-3 border-b cursor-pointer hover:bg-blue-100 select-none"
                    onClick={() => handleSort('start_time')}
                  >
                    <div className="flex items-center gap-1">
                      Start Time
                      {getSortIcon('start_time')}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 border-b cursor-pointer hover:bg-blue-100 select-none"
                    onClick={() => handleSort('stop_time')}
                  >
                    <div className="flex items-center gap-1">
                      Stop Time
                      {getSortIcon('stop_time')}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 border-b cursor-pointer hover:bg-blue-100 select-none text-right"
                    onClick={() => handleSort('num_records')}
                  >
                    <div className="flex items-center gap-1 justify-end">
                      Records
                      {getSortIcon('num_records')}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 border-b cursor-pointer hover:bg-blue-100 select-none text-right"
                    onClick={() => handleSort('duration')}
                  >
                    <div className="flex items-center gap-1 justify-end">
                      Duration (mins)
                      {getSortIcon('duration')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedData.map((row, idx) => {
                  const duration = row.start_time && row.stop_time ? 
                    (new Date(row.stop_time).getTime() - new Date(row.start_time).getTime()) / (1000 * 60) : 0;
                  
                  return (
                    <tr key={idx} className="even:bg-gray-50 hover:bg-gray-100 transition-colors duration-100">
                      <td className="px-4 py-2 border-b" title={row.email}>
                        <div className="max-w-[200px] truncate">
                          {row.email}
                        </div>
                      </td>
                      <td className="px-4 py-2 border-b">
                        <div className="text-xs">
                          {new Date(row.submission_datetime).toLocaleDateString()}
                          <br />
                          {new Date(row.submission_datetime).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-4 py-2 border-b">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          row.transport === 'Walking' ? 'bg-green-100 text-green-800' :
                          row.transport === 'Cycling' ? 'bg-blue-100 text-blue-800' :
                          row.transport === 'Driving' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {row.transport || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2 border-b text-center">
                        <span className={`text-lg ${row.complete ? 'text-green-600' : 'text-red-600'}`}>
                          {row.complete ? "✓" : "✗"}
                        </span>
                      </td>
                      <td className="px-4 py-2 border-b text-center">
                        <span className={`text-lg ${row.csv_check ? 'text-green-600' : 'text-red-600'}`}>
                          {row.csv_check ? "✓" : "✗"}
                        </span>
                      </td>
                      <td className="px-4 py-2 border-b text-center">
                        <span className={`text-lg ${row.temp_check ? 'text-green-600' : 'text-red-600'}`}>
                          {row.temp_check ? "✓" : "✗"}
                        </span>
                      </td>
                      <td className="px-4 py-2 border-b text-center">
                        <span className={`text-lg ${row.location_check ? 'text-green-600' : 'text-red-600'}`}>
                          {row.location_check ? "✓" : "✗"}
                        </span>
                      </td>
                      <td className="px-4 py-2 border-b">
                        <div className="text-xs">
                          {row.start_time ? (
                            <>
                              {new Date(row.start_time).toLocaleDateString()}
                              <br />
                              {new Date(row.start_time).toLocaleTimeString()}
                            </>
                          ) : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-2 border-b">
                        <div className="text-xs">
                          {row.stop_time ? (
                            <>
                              {new Date(row.stop_time).toLocaleDateString()}
                              <br />
                              {new Date(row.stop_time).toLocaleTimeString()}
                            </>
                          ) : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-2 border-b text-right font-mono">
                        {row.num_records.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 border-b text-right font-mono">
                        {duration > 0 ? duration.toFixed(1) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        
        {filteredAndSortedData.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            No submissions match your current filters
          </div>
        )}
      </section>
    </main>
  );
}