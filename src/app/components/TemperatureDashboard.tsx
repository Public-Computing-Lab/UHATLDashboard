"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";
import { createClient } from '@/lib/supabase';
import { useMap } from "react-leaflet";

const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(m => m.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import("react-leaflet").then(m => m.CircleMarker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then(m => m.Popup), { ssr: false });

interface TemperaturePoint {
  date: string;
  time: string;
  latitude: number;
  longitude: number;
  probe_temperature_f: number;
  transit: string;
}

interface DownloadSummary {
  count: number;
  dateRange: string;
  timeRange: string;
  transport: string;
  estimatedSizeMB: number;
}

function MapRefConnector({ setRef }: { setRef: (map: LeafletMap) => void }) {
  const map = useMap();

  useEffect(() => {
    setRef(map);
  }, [map, setRef]);

  return null;
}

// Function to get color based on temperature
function getTemperatureColor(temp: number): string {
  if (temp < 32) return "#0066cc"; // Blue - freezing
  if (temp < 50) return "#00cccc"; // Cyan - cold
  if (temp < 70) return "#00cc00"; // Green - cool
  if (temp < 80) return "#cccc00"; // Yellow - warm
  if (temp < 90) return "#ff8800"; // Orange - hot
  return "#ff0000"; // Red - very hot
}

// Function to get transport icon
function getTransportIcon(transit: string): string {
  switch (transit?.toLowerCase()) {
    case "walking": return "🚶";
    case "cycling": return "🚴";
    case "driving": return "🚗";
    default: return "📍";
  }
}

function TemperatureMarkers({ points }: { points: TemperaturePoint[] }) {
  return (
    <>
      {points.map((point, index) => (
        <CircleMarker
          key={index}
          center={[point.latitude, point.longitude]}
          radius={4.5}
          fillColor={getTemperatureColor(point.probe_temperature_f)}
          color="#ffffff"
          weight={0.25}
          opacity={0.5}
          fillOpacity={1}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-semibold flex items-center gap-1">
                <span>{getTransportIcon(point.transit)}</span>
                <span>{point.probe_temperature_f}°F</span>
              </div>
              <div className="text-gray-600">
                <div>{point.date} {point.time}</div>
                <div>Transport: {point.transit}</div>
                <div>
                  Location: {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
                </div>
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}

// Helper function to get default dates
function getDefaultDates() {
  const now = new Date();
  
  return {
    selectedDate: now.toISOString().split('T')[0],
    currentTime: now.toTimeString().slice(0, 5) // HH:MM format
  };
}

// Helper function to convert data to CSV
function convertToCSV(data: TemperaturePoint[]): string {
  const headers = ['date', 'time', 'latitude', 'longitude', 'probe_temperature_f', 'transit'];
  const csvRows = [headers.join(',')];
  
  for (const point of data) {
    const row = [
      point.date,
      point.time,
      point.latitude,
      point.longitude,
      point.probe_temperature_f,
      point.transit
    ];
    csvRows.push(row.join(','));
  }
  
  return csvRows.join('\n');
}

// Helper function to trigger CSV download
function downloadCSV(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function TemperatureDashboard() {
  const { selectedDate: defaultSelectedDate, currentTime } = getDefaultDates();
  
  // Map filter states - changed to single date
  const [selectedDate, setSelectedDate] = useState(defaultSelectedDate);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [transport, setTransport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [temperaturePoints, setTemperaturePoints] = useState<TemperaturePoint[]>([]);
  const [showOnMap, setShowOnMap] = useState(true);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [mapStyle, setMapStyle] = useState<keyof typeof mapStyles>("clean");
  const mapRef = useRef<LeafletMap | null>(null);
  
  // Download filter states (separate from map filters)
  const [downloadStartDate, setDownloadStartDate] = useState("");
  const [downloadEndDate, setDownloadEndDate] = useState("");
  const [downloadStartTime, setDownloadStartTime] = useState("");
  const [downloadEndTime, setDownloadEndTime] = useState("");
  const [downloadTransport, setDownloadTransport] = useState<string | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadSummary, setDownloadSummary] = useState<DownloadSummary | null>(null);
  const [downloadData, setDownloadData] = useState<TemperaturePoint[] | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  
  const supabase = createClient();

  // Map style options
  const mapStyles = {
    minimal: {
      name: "Minimal",
      url: "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
      attribution: "&copy; OpenStreetMap, &copy; CARTO"
    },
    clean: {
      name: "Clean",
      url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      attribution: "&copy; OpenStreetMap, &copy; CARTO"
    },
    grayscale: {
      name: "Grayscale",
      url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      attribution: "&copy; OpenStreetMap, &copy; CARTO",
      filter: "grayscale(100%)"
    },
    dark: {
      name: "Dark",
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      attribution: "&copy; OpenStreetMap, &copy; CARTO"
    },
    standard: {
      name: "Standard",
      url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
      attribution: "&copy; OpenStreetMap contributors"
    },
    satellite: {
      name: "Satellite",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles &copy; Esri"
    }
  } as const;

  const fetchPoints = async (isInitialLoad = false) => {
    const map = mapRef.current;
    if (!map) {
      if (!isInitialLoad) {
        alert("Map not ready");
      }
      return;
    }

    setLoading(true);
    const bounds = map.getBounds();
    
    const payload = {
      startDate: selectedDate,
      endDate: selectedDate, // Same day for both start and end
      startTime,
      endTime,
      transport,
      bounds: {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      },
    };

    try {
      console.log("Fetching temperature points with payload:", payload);
      
      const { data: json, error } = await supabase.functions.invoke("get-temperature-points", {
        body: payload,
      });

      if (error) {
        console.error("Supabase function error:", error);
        if (!isInitialLoad) {
          alert(`Error: ${error.message}`);
        }
        return;
      }
      
      setLastResult(json);
      
      if (!json.success) {
        console.error("Function returned error:", json);
        if (!isInitialLoad) {
          alert(`Error: ${json.message || json.error}`);
        }
        return;
      }

      console.log(`Found ${json.count} temperature points (${json.totalFromDb} before time filtering)`);
      
      // Update map data
      setTemperaturePoints(json.data || []);
      
      if (!isInitialLoad && json.data && json.data.length === 0) {
        alert("No data found for the selected criteria");
      }
      
      if (isInitialLoad) {
        setHasInitiallyLoaded(true);
      }
    } catch (error) {
      console.error("Fetch error:", error);
      if (!isInitialLoad) {
        alert("Failed to fetch data");
      }
    } finally {
      setLoading(false);
    }
  };

  // Replace the previewDownload function (around line 308)
  const previewDownload = async () => {
    if (!downloadStartDate || !downloadEndDate) {
      alert("Please select both start and end dates for download");
      return;
    }

    setDownloadLoading(true);
    setDownloadSummary(null);
    setDownloadProgress(0);

    try {
      console.log("Previewing download...");
      
      // Use the stream function to get a sample and count
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase configuration missing');
      }

      // Call the stream function with limit 1 to get count
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-csv-download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          startDate: downloadStartDate,
          endDate: downloadEndDate,
          startTime: downloadStartTime,
          endTime: downloadEndTime,
          transport: downloadTransport,
          offset: 0,
          limit: 1 // Just get 1 record to get the total count
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Preview fetch failed:', response.status, errorText);
        throw new Error(`Preview failed (${response.status}): ${errorText}`);
      }

      const json = await response.json();

      if (!json.success) {
        console.error("Function returned error:", json);
        throw new Error(json.error || 'Failed to get preview');
      }

      const totalCount = json.total || 0;
      const estimatedSizeMB = (totalCount * 150) / (1024 * 1024);

      // Build filter summary
      const dateRange = `${downloadStartDate} to ${downloadEndDate}`;
      const timeRange = downloadStartTime || downloadEndTime 
        ? `${downloadStartTime || '00:00'} to ${downloadEndTime || '23:59'}`
        : 'All day';
      const transportFilter = downloadTransport || 'All';

      const summary: DownloadSummary = {
        count: totalCount,
        dateRange,
        timeRange,
        transport: transportFilter,
        estimatedSizeMB: Math.round(estimatedSizeMB * 100) / 100
      };

      setDownloadSummary(summary);
      
      console.log(`Preview ready: ${totalCount} total records, ~${estimatedSizeMB.toFixed(2)} MB`);
      
      if (totalCount === 0) {
        alert("No data found for the selected date range. Please adjust your filters.");
      } else if (downloadStartTime || downloadEndTime) {
        console.log(`Note: Time filtering will be applied during download`);
      }
    } catch (error) {
      console.error("Preview error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Failed to preview download: ${errorMessage}\n\nCheck console for details.`);
    } finally {
      setDownloadLoading(false);
    }
  };

  // Execute CSV download using server-side generation
  const executeDownload = async () => {
    if (!downloadSummary) {
      alert("No preview available");
      return;
    }

    setDownloadLoading(true);
    setDownloadProgress(0);

    try {
      console.log('Starting memory-efficient chunked CSV download...');

      const payload = {
        startDate: downloadStartDate,
        endDate: downloadEndDate,
        startTime: downloadStartTime,
        endTime: downloadEndTime,
        transport: downloadTransport,
      };

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase configuration missing');
      }

      // Array to hold Blob chunks (memory efficient)
      const blobParts: BlobPart[] = [];
      
      // Add CSV headers as first chunk
      blobParts.push('date,time,latitude,longitude,probe_temperature_f,transit\n');
      
      const CHUNK_SIZE = 5000;
      let offset = 0;
      let hasMore = true;
      let totalFetched = 0;

      // Fetch data in chunks and immediately convert to Blob parts
      while (hasMore) {
        console.log(`Fetching chunk at offset ${offset}...`);
        
        const response = await fetch(`${supabaseUrl}/functions/v1/generate-csv-download`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            ...payload,
            offset,
            limit: CHUNK_SIZE
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Chunk fetch failed:', response.status, errorText);
          throw new Error(`Chunk fetch failed (${response.status}): ${errorText}`);
        }

        const chunk = await response.json();

        if (!chunk.success) {
          console.error('Chunk error:', chunk);
          throw new Error(chunk.error || 'Failed to fetch chunk');
        }

        console.log(`Received chunk with ${chunk.fetchedCount} records`);

        // Convert chunk to CSV string
        let chunkCsv = '';
        for (const row of chunk.data) {
          chunkCsv += `${row.date},${row.time},${row.latitude},${row.longitude},${row.probe_temperature_f},${row.transit}\n`;
        }
        
        // Add this chunk as a Blob part (browser handles this efficiently)
        if (chunkCsv.length > 0) {
          blobParts.push(chunkCsv);
        }

        totalFetched += chunk.fetchedCount;
        offset += CHUNK_SIZE;
        hasMore = chunk.hasMore;

        // Update progress
        const progress = Math.min(Math.round((totalFetched / downloadSummary.count) * 100), 100);
        setDownloadProgress(progress);
        
        console.log(`Progress: ${progress}% (${totalFetched.toLocaleString()} / ${downloadSummary.count.toLocaleString()} records)`);

        // Small delay to prevent overwhelming the browser
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      console.log(`All chunks fetched (${totalFetched} records), creating final blob...`);

      // Create final Blob from all parts (browser efficiently combines them)
      const blob = new Blob(blobParts, { type: 'text/csv;charset=utf-8;' });
      
      console.log(`Blob created (${(blob.size / 1024 / 1024).toFixed(2)} MB), triggering download...`);

      // Trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `temperature_data_${downloadStartDate}_to_${downloadEndDate}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL object
      setTimeout(() => window.URL.revokeObjectURL(url), 100);

      console.log(`Download complete: ${totalFetched.toLocaleString()} records`);
      alert(`Successfully downloaded ${totalFetched.toLocaleString()} records!`);

      // Clear download state
      setDownloadStartDate("");
      setDownloadEndDate("");
      setDownloadStartTime("");
      setDownloadEndTime("");
      setDownloadTransport(null);
      setDownloadSummary(null);
      setDownloadProgress(0);

    } catch (error) {
      console.error("Download error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Failed to download data: ${errorMessage}\n\nCheck console for details.`);
    } finally {
      setDownloadLoading(false);
    }
  };

  // Auto-load initial data when map is ready
  useEffect(() => {
    if (mapRef.current && !hasInitiallyLoaded && !loading) {
      console.log("Auto-loading initial data for today...");
      fetchPoints(true);
    }
  }, [mapRef.current, hasInitiallyLoaded, loading]);

  const applyFilters = () => fetchPoints(false);

  // Clear points from map
  const clearPoints = () => {
    setTemperaturePoints([]);
    setLastResult(null);
  };

  // Reset to defaults
  const resetToDefaults = () => {
    const { selectedDate: newSelectedDate } = getDefaultDates();
    setSelectedDate(newSelectedDate);
    setStartTime("");
    setEndTime("");
    setTransport(null);
    setMapStyle("clean");
    setTemperaturePoints([]);
    setLastResult(null);
    setHasInitiallyLoaded(false); // This will trigger auto-load with new defaults
  };

  return (
    <main className="flex flex-col min-h-screen p-6 max-w-7xl mx-auto space-y-8">
      <h1 className="text-3xl font-semibold text-white">Temperature Dashboard</h1>
      
      {/* Map Style and Temperature Scale Band */}
      <div className="bg-white text-gray-800 p-6 rounded-lg border border-gray-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Map Style Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Map Style</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(mapStyles).map(([key, style]) => (
                <button
                  key={key}
                  onClick={() => setMapStyle(key as keyof typeof mapStyles)}
                  className={`px-2 py-1 border rounded text-xs transition-colors ${
                    mapStyle === key 
                      ? "bg-blue-600 text-white border-blue-600" 
                      : "bg-gray-100 hover:bg-gray-200 border-gray-300"
                  }`}
                >
                  {style.name}
                </button>
              ))}
            </div>
          </div>

          {/* Temperature Scale Section */}
          <div>
            <div className="text-sm font-medium text-gray-700 mb-3">Temperature Scale</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{backgroundColor: "#0066cc"}}></div>
                <span>&lt;32°F</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{backgroundColor: "#00cccc"}}></div>
                <span>32-50°F</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{backgroundColor: "#00cc00"}}></div>
                <span>50-70°F</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{backgroundColor: "#cccc00"}}></div>
                <span>70-80°F</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{backgroundColor: "#ff8800"}}></div>
                <span>80-90°F</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{backgroundColor: "#ff0000"}}></div>
                <span>&gt;90°F</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Map */}
        <div 
          className="rounded-lg overflow-hidden border border-gray-300 shadow-md h-[500px] md:h-[600px]"
        >
          <MapContainer
              center={[33.7756, -84.3963]} // Atlanta coordinates
              zoom={12}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={true}
          >
              <TileLayer
                  attribution={mapStyles[mapStyle].attribution}
                  url={mapStyles[mapStyle].url}
              />
              <MapRefConnector setRef={(map) => { mapRef.current = map; }} />
              {showOnMap && <TemperatureMarkers points={temperaturePoints} />}
          </MapContainer>
        </div>

        {/* Filter UI */}
        <div className="bg-white text-gray-800 p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Map Filters</h2>
            <button
              onClick={resetToDefaults}
              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              Reset Defaults
            </button>
          </div>
          
          {/* Single Date input */}
          <div className="mb-4">
            <label className="block text-xs text-gray-600 mb-1">Select Date</label>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)} 
              className="border rounded px-2 py-1 text-sm w-full" 
            />
            <div className="text-xs text-gray-500 mt-1">
              Showing data for: {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </div>

          {/* Time inputs */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Start Time Bound (optional)</label>
              <input 
                type="time" 
                value={startTime} 
                onChange={(e) => setStartTime(e.target.value)} 
                className="border rounded px-2 py-1 text-sm w-full" 
                placeholder="Leave empty for all day"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">End Time Bound (optional)</label>
              <input 
                type="time" 
                value={endTime} 
                onChange={(e) => setEndTime(e.target.value)} 
                className="border rounded px-2 py-1 text-sm w-full" 
              />
            </div>
          </div>

          {/* Transport buttons */}
          <div className="mb-4">
            <label className="block text-xs text-gray-600 mb-2">Transport Type</label>
            <div className="flex flex-wrap gap-2">
              {["Walking", "Cycling", "Driving", "Other"].map((type) => (
                <button
                  key={type}
                  onClick={() => setTransport(type === transport ? null : type)}
                  className={`px-3 py-1 border rounded text-sm transition-colors ${
                    transport === type 
                      ? "bg-blue-600 text-white border-blue-600" 
                      : "bg-gray-100 hover:bg-gray-200 border-gray-300"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            {transport && (
              <div className="text-xs text-gray-500 mt-1">
                Selected: {transport} (click again to clear)
              </div>
            )}
          </div>

          {/* Primary Apply button */}
          <div className="space-y-2">
            <button
              onClick={applyFilters}
              disabled={loading}
              className={`w-full py-3 rounded-lg font-semibold transition text-lg ${
                loading
                  ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Loading...
                </div>
              ) : (
                "Apply Filters"
              )}
            </button>

            {temperaturePoints.length > 0 && (
              <button
                onClick={clearPoints}
                className="w-full py-2 rounded font-medium transition text-sm bg-red-600 text-white hover:bg-red-700"
              >
                Clear Map
              </button>
            )}
          </div>

          {/* Loading indicator for initial load */}
          {!hasInitiallyLoaded && (
            <div className="mt-4 p-3 bg-blue-50 rounded text-sm text-blue-700">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                Loading today's data...
              </div>
            </div>
          )}

          {/* Results summary */}
          {lastResult && lastResult.success && (
            <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
              <div className="font-medium text-green-700 mb-1">
                Found {lastResult.count} temperature points
              </div>
              <div className="text-gray-600 space-y-1">
                <div>Date: {lastResult.filters.dateRange}</div>
                <div>Time: {lastResult.filters.timeRange}</div>
                <div>Transport: {lastResult.filters.transport}</div>
                {lastResult.totalFromDb !== lastResult.count && (
                  <div className="text-orange-600">
                    ({lastResult.totalFromDb} total, {lastResult.count} after time filtering)
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Download Section */}
      <section className="bg-white text-gray-800 p-6 rounded-lg border border-gray-200 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Download Data</h2>
        
        <div className={`space-y-4 ${downloadLoading ? 'opacity-50 pointer-events-none' : ''}`}>
          {/* Download Date inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Start Date *</label>
              <input 
                type="date" 
                value={downloadStartDate} 
                onChange={(e) => setDownloadStartDate(e.target.value)} 
                className="border rounded px-2 py-1 text-sm w-full" 
                disabled={downloadLoading}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">End Date *</label>
              <input 
                type="date" 
                value={downloadEndDate} 
                onChange={(e) => setDownloadEndDate(e.target.value)} 
                className="border rounded px-2 py-1 text-sm w-full" 
                disabled={downloadLoading}
                required
              />
            </div>
          </div>

          {/* Download Time inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Start Time Bound (optional)</label>
              <input 
                type="time" 
                value={downloadStartTime} 
                onChange={(e) => setDownloadStartTime(e.target.value)} 
                className="border rounded px-2 py-1 text-sm w-full" 
                disabled={downloadLoading}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">End Time Bound (optional)</label>
              <input 
                type="time" 
                value={downloadEndTime} 
                onChange={(e) => setDownloadEndTime(e.target.value)} 
                className="border rounded px-2 py-1 text-sm w-full" 
                disabled={downloadLoading}
              />
            </div>
          </div>

          {/* Download Transport buttons */}
          <div>
            <label className="block text-xs text-gray-600 mb-2">Transport Type (optional)</label>
            <div className="flex flex-wrap gap-2">
              {["Walking", "Cycling", "Driving", "Other"].map((type) => (
                <button
                  key={type}
                  onClick={() => setDownloadTransport(type === downloadTransport ? null : type)}
                  disabled={downloadLoading}
                  className={`px-3 py-1 border rounded text-sm transition-colors ${
                    downloadTransport === type 
                      ? "bg-blue-600 text-white border-blue-600" 
                      : "bg-gray-100 hover:bg-gray-200 border-gray-300"
                  } ${downloadLoading ? 'cursor-not-allowed' : ''}`}
                >
                  {type}
                </button>
              ))}
            </div>
            {downloadTransport && (
              <div className="text-xs text-gray-500 mt-1">
                Selected: {downloadTransport} (click again to clear)
              </div>
            )}
          </div>

          {/* Preview button */}
          <button
            onClick={previewDownload}
            disabled={downloadLoading || !downloadStartDate || !downloadEndDate}
            className={`w-full py-3 rounded-lg font-semibold transition text-lg ${
              downloadLoading || !downloadStartDate || !downloadEndDate
                ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {downloadLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Preparing Preview...
              </div>
            ) : (
              "Preview Download"
            )}
          </button>

          {/* Download Summary */}
          {downloadSummary && (
            <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200">
              <div className="font-semibold text-blue-900 mb-2">Download Summary</div>
              <div className="text-sm text-blue-800 space-y-1">
                <div className="font-medium">Total Records: {downloadSummary.count.toLocaleString()}</div>
                <div>Date Range: {downloadSummary.dateRange}</div>
                <div>Time Range: {downloadSummary.timeRange}</div>
                <div>Transport: {downloadSummary.transport}</div>
                <div>Estimated Size: ~{downloadSummary.estimatedSizeMB} MB</div>
              </div>

              {/* Info about chunked download */}
              <div className="mt-3 p-2 bg-blue-100 border border-blue-300 rounded text-sm text-blue-800">
                ℹ️ Large datasets are downloaded in memory-efficient chunks. Keep this tab open during download.
              </div>

              {/* Progress bar */}
              {downloadProgress > 0 && downloadProgress < 100 && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-blue-700 mb-1">
                    <span>Downloading...</span>
                    <span>{downloadProgress}%</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${downloadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Download button */}
              <button
                onClick={executeDownload}
                disabled={downloadLoading}
                className={`w-full mt-3 py-2 rounded-lg font-semibold transition ${
                  downloadLoading
                    ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {downloadLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {downloadProgress > 0 ? `Downloading ${downloadProgress}%...` : "Starting..."}
                  </div>
                ) : (
                  "Download CSV"
                )}
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}