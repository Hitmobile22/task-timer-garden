
import React from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, Bell, Calendar, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ProjectNotification } from '@/hooks/useProjectNotifications';
import { formatDueDateStatus } from '@/lib/utils';

interface NotificationListProps {
  notifications: ProjectNotification[];
  isLoading: boolean;
  onMarkAsRead: (id: number) => void;
  onMarkAllAsRead: () => void;
}

export const NotificationList = ({
  notifications,
  isLoading,
  onMarkAsRead,
  onMarkAllAsRead
}: NotificationListProps) => {
  if (isLoading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Loading notifications...
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="p-4 text-center">
        <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
        <p className="text-muted-foreground">No new notifications</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold">Notifications</h3>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
          onClick={onMarkAllAsRead}
        >
          <Check className="h-3 w-3" />
          Clear all
        </Button>
      </div>
      <div className="divide-y">
        {notifications.map((notification) => (
          <NotificationItem 
            key={notification.id} 
            notification={notification} 
            onMarkAsRead={onMarkAsRead} 
          />
        ))}
      </div>
    </div>
  );
};

const NotificationItem = ({ 
  notification, 
  onMarkAsRead 
}: { 
  notification: ProjectNotification;
  onMarkAsRead: (id: number) => void;
}) => {
  const dueDate = new Date(notification.due_date);
  const dueDateStatus = formatDueDateStatus(dueDate);
  
  return (
    <div className="p-3 hover:bg-muted/50">
      <div className="flex justify-between items-start gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <span className="font-medium">{notification.project_name}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {dueDateStatus} ({dueDate.toLocaleDateString()})
          </p>
          <div className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => onMarkAsRead(notification.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
