"use client";
import { useState } from "react";
import SubmissionDashboard from "./SubmissionDashboard";
import TemperatureDashboard from "./TemperatureDashboard";
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

export default function DashboardTabs() {
  const [activeTab, setActiveTab] = useState<"submission" | "temperature">("submission");
  const supabase = createClient();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
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
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-black bg-opacity-20 hover:opacity-30 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>

      {/* Content Area */}
      <div className="p-4">
        {isSubmission ? <SubmissionDashboard /> : <TemperatureDashboard />}
      </div>
    </div>
  );
}
