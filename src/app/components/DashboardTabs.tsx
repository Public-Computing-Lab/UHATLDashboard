"use client";
import { useState } from "react";
import SubmissionDashboard from "./SubmissionDashboard";
import TemperatureDashboard from "./TemperatureDashboard";
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

export default function DashboardTabs() {
  const [activeTab, setActiveTab] = useState<"submission" | "temperature">("submission");
  const [loggingOut, setLoggingOut] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      
      // Try to sign out, but don't fail if session is missing
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (error) {
        // Ignore session errors - user might already be logged out
        console.log('Clearing local session');
      }
      
      // Clear any local storage
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      
      // Force a hard navigation to clear all state
      window.location.href = '/';
      
    } catch (error) {
      console.error('Unexpected logout error:', error);
      // Still redirect even if there's an error
      window.location.href = '/';
    } finally {
      setLoggingOut(false);
    }
  };

  const isSubmission = activeTab === "submission";
  const bgColor = isSubmission ? "bg-[#b78fbf]" : "bg-[#1e3a8a]";

  return (
    <div className={`min-h-screen w-full transition-colors duration-300 ${bgColor}`}>

      {/* Tab Bar */}
      <div className="flex">
        <button
          onClick={() => setActiveTab("submission")}
          className={`w-1/2 py-4 text-center font-semibold text-lg transition-colors duration-200 ${
            isSubmission
              ? "bg-[#b78fbf] text-black border-b-4 border-white"
              : "bg-[#e5e5e5] text-gray-700 hover:bg-[#d4a7d8] hover:text-white"
          }`}
        >
          Submission Data
        </button>
        <button
          onClick={() => setActiveTab("temperature")}
          className={`w-1/2 py-4 text-center font-semibold text-lg transition-colors duration-200 ${
            !isSubmission
              ? "bg-[#2d4fb8] text-white border-b-4 border-white"
              : "bg-[#cbd5e1] text-gray-800 hover:bg-[#2d4fb8] hover:text-white"
          }`}
        >
          Temperature Data
        </button>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-black bg-opacity-20 hover:bg-opacity-30 transition-colors ${
            loggingOut ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <LogOut className="w-4 h-4" />
          {loggingOut ? 'Logging out...' : 'Logout'}
        </button>
      </div>

      {/* Content Area */}
      <div className="p-4">
        {isSubmission ? <SubmissionDashboard /> : <TemperatureDashboard />}
      </div>
    </div>
  );
}
