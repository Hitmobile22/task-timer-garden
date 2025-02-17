
import React from 'react';
import { Button } from "@/components/ui/button";
import { 
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuTrigger,
  NavigationMenuContent,
} from "@/components/ui/navigation-menu";
import { CalendarDays, Clock, ListTodo } from "lucide-react";

export const TaskViewHeader2 = () => {
  return (
    <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-white">Task View 2.0</h1>
        <p className="text-white/80">Manage your tasks and projects efficiently</p>
      </div>

      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger className="bg-white/10 text-white hover:bg-white/20">
              Switch View
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <div className="grid gap-2 p-4 w-[200px]">
                <NavigationMenuLink
                  href="/tasks"
                  className="block p-2 hover:bg-slate-100 rounded-md"
                >
                  <div className="flex items-center gap-2">
                    <ListTodo className="w-4 h-4" />
                    <span>Classic View</span>
                  </div>
                </NavigationMenuLink>
                <NavigationMenuLink
                  href="/scheduler"
                  className="block p-2 hover:bg-slate-100 rounded-md"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>Timer View</span>
                  </div>
                </NavigationMenuLink>
                <NavigationMenuLink
                  href="/calendar"
                  className="block p-2 hover:bg-slate-100 rounded-md"
                >
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" />
                    <span>Calendar View</span>
                  </div>
                </NavigationMenuLink>
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </header>
  );
};
