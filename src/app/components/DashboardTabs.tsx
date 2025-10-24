"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { LogOut } from "lucide-react";
import SubmissionDashboard from "./SubmissionDashboard";
import TemperatureDashboard from "./TemperatureDashboard";

export default function DashboardTabs() {
  const [activeTab, setActiveTab] = useState<"submission" | "temperature">("submission");
  const router = useRouter();
  const supabase = createClient();

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
      <div className="flex relative">
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
        
        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="p-4">
        {isSubmission ? <SubmissionDashboard /> : <TemperatureDashboard />}
      </div>
    </div>
  );
}
