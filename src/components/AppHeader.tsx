import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, Plus, Users, Clock, Settings, User, LogOut } from "lucide-react";
import Link from "next/link";

interface AppHeaderProps {
  currentUser?: string;
}

export function AppHeader({ currentUser }: AppHeaderProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    router.push("/");
  };

  const navItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/clients", label: "Clients" },
    { href: "/time-logs", label: "Time Logs" },
    { href: "/rollover-management", label: "Rollover Management" },
    { href: "/settings", label: "Settings" },
    { href: "/my-account", label: "My Account" },
  ];

  if (!mounted) return null;

  return (
    <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/dashboard">
          <div className="cursor-pointer">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-brand-primary to-slate-700 bg-clip-text text-transparent">
              Timesheets
            </h1>
            {currentUser && (
              <p className="text-sm text-slate-600 mt-0.5">{currentUser}</p>
            )}
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <Link href="/log-time">
            <Button 
              variant="default"
              className="bg-brand-primary hover:bg-brand-primary-hover h-10 gap-2"
              title="Log Time"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden md:inline">Log Time</span>
            </Button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="relative h-10 w-10">
                <Menu className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/clients" className="flex items-center gap-2 cursor-pointer">
                  <Users className="w-4 h-4" />
                  Clients
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/time-logs" className="flex items-center gap-2 cursor-pointer">
                  <Clock className="w-4 h-4" />
                  Time Logs
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
                  <Settings className="w-4 h-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/my-account" className="flex items-center gap-2 cursor-pointer">
                  <User className="w-4 h-4" />
                  My Account
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-600"
              >
                <LogOut className="w-4 h-4" />
                Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
