
import React from 'react';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Menu } from 'lucide-react';

export const MenuBar = () => {
  return (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger className="hover-lift">
            <Menu className="h-4 w-4 mr-2" />
            Menu
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid gap-3 p-4 w-[200px]">
              <li>
                <NavigationMenuLink
                  className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  href="/tasks"
                >
                  <div className="text-sm font-medium leading-none">Task View</div>
                  <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                    View and manage your tasks
                  </p>
                </NavigationMenuLink>
              </li>
              <li>
                <NavigationMenuLink
                  className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  href="/calendar"
                >
                  <div className="text-sm font-medium leading-none">Calendar View</div>
                  <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                    Schedule and plan your tasks
                  </p>
                </NavigationMenuLink>
              </li>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
};
