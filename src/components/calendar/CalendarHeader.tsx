
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
      <GoogleCalendarIntegration onManualSync={handleRefreshCalendar} />
    </div>
  );
};
