
import React, { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserMenu } from "@/components/UserMenu";
import { Menu, Calendar, List, ClipboardList, ChevronDown, Zap, RefreshCw, Sun, Moon, Palette, Check } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useUnifiedRecurringTasksCheck } from "@/hooks/useUnifiedRecurringTasksCheck";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

export const MenuBar = () => {
  const location = useLocation();
  const recurringTasksChecker = useUnifiedRecurringTasksCheck();
  const [isOpen, setIsOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const handleGenerateRecurringTasks = async () => {
    toast.info('Checking for recurring tasks...');
    try {
      await recurringTasksChecker.forceCheck();
      toast.success('Recurring tasks updated');
    } catch (error) {
      console.error('Error triggering recurring tasks:', error);
      toast.error('Failed to check recurring tasks');
    }
  };

  return (
    <div className="flex items-center justify-between w-full">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <button 
            className="hover-lift flex items-center px-4 py-2 rounded-md text-primary-foreground bg-primary shadow-md hover:bg-primary/90 transition-all duration-200"
            onMouseEnter={() => setIsOpen(true)}
          >
            <Menu className="h-5 w-5 mr-2" />
            <span>Menu</span>
            <ChevronDown className="ml-1 h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          className="bg-popover/95 backdrop-blur-md rounded-md shadow-lg w-[220px]"
          onMouseLeave={() => setIsOpen(false)}
        >
          {/* Actions Submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center space-x-2 p-3 rounded-md text-popover-foreground hover:bg-accent">
              <Zap className="h-5 w-5 text-orange-500" />
              <span className="text-sm font-medium">Actions</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="bg-popover backdrop-blur-md shadow-lg z-[100]">
                <DropdownMenuItem 
                  onClick={handleGenerateRecurringTasks}
                  disabled={recurringTasksChecker.isChecking}
                  className="flex items-center space-x-2 p-3 rounded-md text-popover-foreground hover:bg-accent cursor-pointer"
                >
                  <RefreshCw className={cn("h-5 w-5 text-blue-500", recurringTasksChecker.isChecking && "animate-spin")} />
                  <span className="text-sm font-medium">
                    {recurringTasksChecker.isChecking ? 'Generating...' : 'Generate Recurring Tasks'}
                  </span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          {/* Theme Submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center space-x-2 p-3 rounded-md text-popover-foreground hover:bg-accent">
              <Palette className="h-5 w-5 text-violet-500" />
              <span className="text-sm font-medium">Theme</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="bg-popover backdrop-blur-md shadow-lg z-[100]">
                <DropdownMenuItem 
                  onClick={() => setTheme("default")}
                  className="flex items-center space-x-2 p-3 rounded-md text-popover-foreground hover:bg-accent cursor-pointer"
                >
                  <Sun className="h-5 w-5 text-amber-500" />
                  <span className="text-sm font-medium">Default</span>
                  {theme === "default" && <Check className="h-4 w-4 ml-auto text-green-500" />}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setTheme("night")}
                  className="flex items-center space-x-2 p-3 rounded-md text-popover-foreground hover:bg-accent cursor-pointer"
                >
                  <Moon className="h-5 w-5 text-indigo-400" />
                  <span className="text-sm font-medium">Night</span>
                  {theme === "night" && <Check className="h-4 w-4 ml-auto text-green-500" />}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
          
          <DropdownMenuSeparator />
          
          {/* Navigation Items */}
          {location.pathname !== "/tasks" && (
            <DropdownMenuItem asChild>
              <a 
                href="/tasks" 
                className="flex items-center space-x-2 p-3 rounded-md text-popover-foreground hover:bg-accent cursor-pointer"
              >
                <ClipboardList className="h-5 w-5 text-blue-500" />
                <span className="text-sm font-medium">Task View</span>
              </a>
            </DropdownMenuItem>
          )}
          {location.pathname !== "/calendar" && (
            <DropdownMenuItem asChild>
              <a 
                href="/calendar" 
                className="flex items-center space-x-2 p-3 rounded-md text-popover-foreground hover:bg-accent cursor-pointer"
              >
                <Calendar className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium">Calendar View</span>
              </a>
            </DropdownMenuItem>
          )}
          {location.pathname !== "/" && (
            <DropdownMenuItem asChild>
              <a 
                href="/" 
                className="flex items-center space-x-2 p-3 rounded-md text-popover-foreground hover:bg-accent cursor-pointer"
              >
                <List className="h-5 w-5 text-purple-500" />
                <span className="text-sm font-medium">Scheduler</span>
              </a>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <UserMenu />
    </div>
  );
};
