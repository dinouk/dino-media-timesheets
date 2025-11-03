import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  try {
    // Store the signup request in Supabase
    const { data, error } = await supabase
      .from("signup_requests")
      .insert([
        {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          status: "pending",
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error storing signup request:", error);
      return res.status(500).json({ error: "Failed to store signup request" });
    }

    // Send email notification using Resend
    // You'll need to set RESEND_API_KEY in your environment variables
    const resendApiKey = process.env.RESEND_API_KEY;

    if (resendApiKey) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "Timesheets App <onboarding@resend.dev>",
            to: ["dean@dino.media"],
            subject: "New Timesheets Signup Request",
            html: `
              <h2>New Signup Request</h2>
              <p>A new user has requested access to the Timesheets application:</p>
              <ul>
                <li><strong>Name:</strong> ${name}</li>
                <li><strong>Email:</strong> ${email}</li>
                <li><strong>Submitted:</strong> ${new Date().toLocaleString()}</li>
              </ul>
              <p>Please review and process this request in the Supabase dashboard.</p>
            `,
          }),
        });

        if (!emailResponse.ok) {
          console.error("Failed to send email:", await emailResponse.text());
        }
      } catch (emailError) {
        console.error("Error sending email:", emailError);
        // Don't fail the request if email fails - the data is still stored
      }
    } else {
      console.warn("RESEND_API_KEY not configured - email notification not sent");
    }

    return res.status(200).json({ 
      success: true, 
      message: "Signup request submitted successfully" 
    });
  } catch (error: any) {
    console.error("Error processing signup request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
