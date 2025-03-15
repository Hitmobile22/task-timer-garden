
import React from 'react';
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { GoogleCalendarIntegration } from "@/components/task/GoogleCalendarIntegration";

interface CalendarHeaderProps {
  handleRefreshCalendar: () => Promise<void>;
  isSyncing: boolean;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({ 
  handleRefreshCalendar, 
  isSyncing 
}) => {
  return (
    <div className="flex justify-end mb-4 gap-2">
      <GoogleCalendarIntegration />
      <Button 
        variant="outline"
        className="flex items-center gap-2"
        onClick={handleRefreshCalendar}
        disabled={isSyncing}
      >
        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
        {isSyncing ? "Syncing..." : "Refresh Google Calendar"}
      </Button>
    </div>
  );
};
