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
  files?: Array<{
    id: string;
    name: string;
    displayName: string;
    data: string;
    type: string;
    size: number;
  }>;
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

export interface ManualRollover {
  id: string;
  clientId: string;
  month: string;
  year: number;
  rolloverHours: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}
