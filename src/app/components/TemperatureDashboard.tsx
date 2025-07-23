"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";
import { useMap } from "react-leaflet";
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

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
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(now.getMonth() - 1);
  
  return {
    startDate: oneMonthAgo.toISOString().split('T')[0],
    endDate: now.toISOString().split('T')[0],
    currentTime: now.toTimeString().slice(0, 5) // HH:MM format
  };
}

export default function TemperatureDashboard() {
  const { startDate: defaultStartDate, endDate: defaultEndDate, currentTime } = getDefaultDates();
  
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState(currentTime);
  const [transport, setTransport] = useState<string | null>("Walking");
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [temperaturePoints, setTemperaturePoints] = useState<TemperaturePoint[]>([]);
  const [showOnMap, setShowOnMap] = useState(true);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [mapStyle, setMapStyle] = useState<keyof typeof mapStyles>("clean");
  const mapRef = useRef<LeafletMap | null>(null);

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

  // Helper function to convert JSON to CSV and trigger download
  const downloadCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map(row => 
        headers.map(header => {
          const cell = row[header];
          return typeof cell === 'string' && cell.includes(',') 
            ? `"${cell}"` 
            : cell;
        }).join(",")
      )
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const fetchPoints = async (downloadCsv = false, isInitialLoad = false) => {
    const map = mapRef.current;
    if (!map || !startDate || !endDate) {
      if (!isInitialLoad) {
        alert("Please select start and end dates");
      }
      return;
    }

    setLoading(true);
    const bounds = map.getBounds();
    const payload = {
      startDate,
      endDate,
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
      
      // Convert to CSV and download if requested
      if (downloadCsv && json.data && json.data.length > 0) {
        const filename = `temperature_data_${startDate}_to_${endDate}${transport ? `_${transport}` : ''}.csv`;
        downloadCSV(json.data, filename);
      } else if (!isInitialLoad && json.data && json.data.length === 0) {
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

  // Auto-load data when map is ready and we haven't loaded yet
  useEffect(() => {
    if (mapRef.current && !hasInitiallyLoaded && !loading) {
      console.log("Auto-loading initial data...");
      fetchPoints(false, true);
    }
  }, [mapRef.current, hasInitiallyLoaded, loading]);

  const loadDataOnly = () => fetchPoints(false);
  const downloadData = () => fetchPoints(true);

  // Clear points from map
  const clearPoints = () => {
    setTemperaturePoints([]);
    setLastResult(null);
  };

  // Reset to defaults
  const resetToDefaults = () => {
    const { startDate: newStartDate, endDate: newEndDate, currentTime: newCurrentTime } = getDefaultDates();
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    setStartTime("");
    setEndTime(newCurrentTime);
    setTransport("Walking");
    setMapStyle("minimal");
    setHasInitiallyLoaded(false); // This will trigger auto-load with new defaults
  };

  return (
    <main className="flex flex-col min-h-screen p-6 max-w-7xl mx-auto space-y-8">
      <h1 className="text-3xl font-semibold text-white">Temperature Dashboard</h1>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Map */}
        <div 
          className="rounded-lg overflow-hidden border border-gray-300 shadow-md h-[500px] md:h-[600px]"
        >
          <MapContainer
              center={[33.7756, -84.3963]} // Atlanta coordinates
              zoom={16}
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
            <h2 className="text-lg font-semibold text-gray-800">Filter</h2>
            <button
              onClick={resetToDefaults}
              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              Reset Defaults
            </button>
          </div>
          
          {/* Date inputs */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Start Date</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                className="border rounded px-2 py-1 text-sm w-full" 
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">End Date</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                className="border rounded px-2 py-1 text-sm w-full" 
              />
            </div>
          </div>

          {/* Time inputs */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Start Time (optional)</label>
              <input 
                type="time" 
                value={startTime} 
                onChange={(e) => setStartTime(e.target.value)} 
                className="border rounded px-2 py-1 text-sm w-full" 
                placeholder="Leave empty for all day"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">End Time</label>
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

          {/* Map display toggle */}
          <div className="mb-4 space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showOnMap}
                onChange={(e) => setShowOnMap(e.target.checked)}
                className="rounded"
              />
              Show points on map
            </label>
            
            {/* Map style selector */}
            <div>
              <label className="block text-xs text-gray-600 mb-2">Map Style</label>
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
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            <button
              onClick={loadDataOnly}
              disabled={loading || !startDate || !endDate}
              className={`w-full py-2 rounded font-semibold transition ${
                loading || !startDate || !endDate
                  ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                  : "bg-green-600 text-white hover:bg-green-700"
              }`}
            >
              {loading ? "Loading..." : "Load Data on Map"}
            </button>
            
            <button
              onClick={downloadData}
              disabled={loading || !startDate || !endDate}
              className={`w-full py-2 rounded font-semibold transition ${
                loading || !startDate || !endDate
                  ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              Download CSV
            </button>

            {temperaturePoints.length > 0 && (
              <button
                onClick={clearPoints}
                className="w-full py-2 rounded font-semibold transition bg-red-600 text-white hover:bg-red-700"
              >
                Clear Map
              </button>
            )}
          </div>

          {/* Auto-load indicator */}
          {!hasInitiallyLoaded && (
            <div className="mt-4 p-2 bg-blue-50 rounded text-sm text-blue-700">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                Auto-loading data with defaults...
              </div>
            </div>
          )}

          {/* Temperature legend */}
          {temperaturePoints.length > 0 && (
            <div className="mt-4 p-3 bg-gray-50 rounded">
              <div className="text-xs font-medium text-gray-700 mb-2">Temperature Scale</div>
              <div className="grid grid-cols-3 gap-1 text-xs">
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
    </main>
  );
}