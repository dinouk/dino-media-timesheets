
import { Client, TimeEntry, MonthlyAllocation, ClientStats, ManualRollover } from "@/types";

export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function calculateClientStats(
  client: Client,
  month: string,
  year: number,
  timeEntries: TimeEntry[],
  monthlyAllocations: MonthlyAllocation[]
): ClientStats {
  const currentMonthKey = `${year}-${String(month).padStart(2, "0")}`;
  
  const allocation = monthlyAllocations.find(
    (a) => a.clientId === client.id && a.month === currentMonthKey
  );

  const allocatedHours = allocation?.allocatedHours ?? client.allocatedHours;
  const rolloverHours = allocation?.rolloverHours ?? 0;

  const usedHours = timeEntries
    .filter((entry) => entry.clientId === client.id && entry.month === currentMonthKey)
    .reduce((sum, entry) => sum + entry.hours, 0);

  const remainingHours = allocatedHours + rolloverHours - usedHours;

  return {
    allocatedHours,
    rolloverHours,
    usedHours,
    remainingHours,
  };
}

export function calculateAutoRollover(
  client: Client,
  targetMonthKey: string,
  timeEntries: TimeEntry[],
  monthlyAllocations: MonthlyAllocation[]
): number {
  const [yearStr, monthStr] = targetMonthKey.split("-");
  const targetYear = parseInt(yearStr);
  const targetMonth = parseInt(monthStr);

  const prevDate = new Date(targetYear, targetMonth - 2, 1);
  const prevMonthKey = getMonthKey(prevDate);

  const prevAllocation = monthlyAllocations.find(
    (a) => a.clientId === client.id && a.month === prevMonthKey
  );

  const prevAllocated = prevAllocation?.allocatedHours ?? client.allocatedHours;
  const prevRollover = prevAllocation?.rolloverHours ?? 0;
  
  const prevUsed = timeEntries
    .filter((entry) => entry.clientId === client.id && entry.month === prevMonthKey)
    .reduce((sum, entry) => sum + entry.hours, 0);

  return prevAllocated + prevRollover - prevUsed;
}

export function processMonthlyRollover(
  clients: Client[],
  timeEntries: TimeEntry[],
  monthlyAllocations: MonthlyAllocation[],
  targetMonth: string,
  targetYear: number,
  manualRollovers: ManualRollover[] = []
): MonthlyAllocation[] {
  const newAllocations: MonthlyAllocation[] = [];
  const currentMonthKey = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;

  clients.forEach((client) => {
    const existingAllocation = monthlyAllocations.find(
      (a) => a.clientId === client.id && a.month === currentMonthKey
    );

    if (!existingAllocation) {
      const manualRollover = manualRollovers.find(
        (r) => r.clientId === client.id && r.month === currentMonthKey
      );

      let rolloverHours: number;
      
      if (manualRollover) {
        rolloverHours = manualRollover.rolloverHours;
      } else {
        rolloverHours = calculateAutoRollover(client, currentMonthKey, timeEntries, monthlyAllocations);
      }

      newAllocations.push({
        clientId: client.id,
        month: currentMonthKey,
        year: targetYear,
        allocatedHours: client.allocatedHours,
        rolloverHours,
      });
    } else if (existingAllocation) {
      const manualRollover = manualRollovers.find(
        (r) => r.clientId === client.id && r.month === currentMonthKey
      );

      if (manualRollover && manualRollover.rolloverHours !== existingAllocation.rolloverHours) {
        const updatedAllocation = {
          ...existingAllocation,
          rolloverHours: manualRollover.rolloverHours,
        };
        const index = monthlyAllocations.findIndex(
          (a) => a.clientId === client.id && a.month === currentMonthKey
        );
        if (index !== -1) {
          monthlyAllocations[index] = updatedAllocation;
        }
      }
    }
  });

  return [...monthlyAllocations, ...newAllocations];
}
