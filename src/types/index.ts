export interface Client {
  id: string;
  name: string;
  allocatedHours: number;
  tags: string[];
  archived: boolean;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  clientId: string;
  date: string;
  hours: number;
  tags: string[];
  description: string;
  month: string;
  year: number;
  createdAt: string;
}

export interface MonthlyAllocation {
  clientId: string;
  month: string;
  year: number;
  allocatedHours: number;
  rolloverHours: number;
}

export interface ClientStats {
  allocatedHours: number;
  rolloverHours: number;
  usedHours: number;
  remainingHours: number;
}
