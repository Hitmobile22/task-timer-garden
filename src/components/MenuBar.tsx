import React from "react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Menu, Calendar, List, ClipboardList } from "lucide-react"; // Adding icons
import { useLocation } from "react-router-dom";

export const MenuBar = () => {
  const location = useLocation(); // Detects current page

  return (
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger className="hover-lift flex items-center px-4 py-2 rounded-md text-white bg-gray-800 shadow-md hover:bg-gray-700 transition-all duration-200">
              <Menu className="h-5 w-5 mr-2" />
              <span>Menu</span>
            </NavigationMenuTrigger>
            <NavigationMenuContent className="bg-white/90 backdrop-blur-md rounded-md shadow-lg p-4 w-[220px]">
              <ul className="grid gap-3">
                {location.pathname !== "/tasks" && (
                    <li>
                      <NavigationMenuLink
                          className="flex items-center space-x-2 p-3 rounded-md text-gray-800 hover:bg-gray-200 transition-all duration-200"
                          href="/tasks"
                      >
                        <ClipboardList className="h-5 w-5 text-blue-500" />
                        <span className="text-sm font-medium">Task View</span>
                      </NavigationMenuLink>
                    </li>
                )}
                {location.pathname !== "/calendar" && (
                    <li>
                      <NavigationMenuLink
                          className="flex items-center space-x-2 p-3 rounded-md text-gray-800 hover:bg-gray-200 transition-all duration-200"
                          href="/calendar"
                      >
                        <Calendar className="h-5 w-5 text-green-500" />
                        <span className="text-sm font-medium">Calendar View</span>
                      </NavigationMenuLink>
                    </li>
                )}
                {location.pathname !== "/" && (
                    <li>
                      <NavigationMenuLink
                          className="flex items-center space-x-2 p-3 rounded-md text-gray-800 hover:bg-gray-200 transition-all duration-200"
                          href="/"
                      >
                        <List className="h-5 w-5 text-purple-500" />
                        <span className="text-sm font-medium">Scheduler</span>
                      </NavigationMenuLink>
                    </li>
                )}
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
  );
};
