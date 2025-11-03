import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

interface Client {
  id: string;
  user_id: string;
  name: string;
  allocated_hours_per_month: number;
  archived: boolean;
}

interface TimeEntry {
  id: string;
  client_id: string;
  hours: number;
  month: string;
}

interface MonthlyAllocation {
  id: string;
  client_id: string;
  month: string;
  year: number;
  allocated_hours: number;
  rollover_hours: number;
}

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get current date to determine which month to generate
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentMonthStr = `${currentYear}-${currentMonth.toString().padStart(2, "0")}`;

    // Get previous month for rollover calculation
    const prevDate = new Date(currentYear, currentMonth - 2); // -2 because month is 1-indexed
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth() + 1;
    const prevMonthStr = `${prevYear}-${prevMonth.toString().padStart(2, "0")}`;

    console.log(`Generating allocations for ${currentMonthStr}, using previous month ${prevMonthStr}`);

    // Get all active clients
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("*")
      .eq("archived", false);

    if (clientsError) throw clientsError;
    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No active clients found",
          generated: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const results = [];

    for (const client of clients as Client[]) {
      // Check if allocation already exists for current month
      const { data: existingAllocation } = await supabase
        .from("monthly_allocations")
        .select("*")
        .eq("client_id", client.id)
        .eq("month", currentMonthStr)
        .single();

      if (existingAllocation) {
        console.log(`Allocation already exists for client ${client.name} (${currentMonthStr})`);
        results.push({
          client: client.name,
          status: "skipped",
          reason: "Already exists",
        });
        continue;
      }

      // Get previous month's allocation
      const { data: prevAllocation } = await supabase
        .from("monthly_allocations")
        .select("*")
        .eq("client_id", client.id)
        .eq("month", prevMonthStr)
        .single();

      // Get previous month's time entries
      const { data: prevEntries } = await supabase
        .from("time_entries")
        .select("hours")
        .eq("client_id", client.id)
        .eq("month", prevMonthStr);

      // Calculate rollover
      const prevUsedHours = (prevEntries as TimeEntry[] || []).reduce(
        (sum, entry) => sum + Number(entry.hours || 0),
        0
      );

      const prevAllocatedHours = prevAllocation 
        ? Number((prevAllocation as MonthlyAllocation).allocated_hours)
        : Number(client.allocated_hours_per_month);

      const prevRolloverHours = prevAllocation
        ? Number((prevAllocation as MonthlyAllocation).rollover_hours)
        : 0;

      const calculatedRollover = prevAllocatedHours + prevRolloverHours - prevUsedHours;

      console.log(`Client: ${client.name}`);
      console.log(`  Previous allocated: ${prevAllocatedHours}h`);
      console.log(`  Previous rollover: ${prevRolloverHours}h`);
      console.log(`  Previous used: ${prevUsedHours}h`);
      console.log(`  Calculated rollover: ${calculatedRollover}h`);

      // Create new allocation for current month
      const { data: newAllocation, error: insertError } = await supabase
        .from("monthly_allocations")
        .insert({
          user_id: client.user_id,
          client_id: client.id,
          month: currentMonthStr,
          year: currentYear,
          allocated_hours: Number(client.allocated_hours_per_month),
          rollover_hours: calculatedRollover,
        })
        .select()
        .single();

      if (insertError) {
        console.error(`Error creating allocation for ${client.name}:`, insertError);
        results.push({
          client: client.name,
          status: "error",
          error: insertError.message,
        });
        continue;
      }

      results.push({
        client: client.name,
        status: "created",
        allocated_hours: client.allocated_hours_per_month,
        rollover_hours: calculatedRollover,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Generated ${results.filter(r => r.status === "created").length} allocations for ${currentMonthStr}`,
        month: currentMonthStr,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error generating monthly allocations:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
}

serve(handler);