import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('No authorization header provided');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.log('User authentication failed:', userError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing scan for user: ${user.id}`);

    // Check if staff is approved
    const { data: staffProfile, error: profileError } = await supabase
      .from('staff_profiles')
      .select('approved, name')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.log('Error fetching staff profile:', profileError.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Profile not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!staffProfile?.approved) {
      console.log(`Staff ${user.id} is not approved`);
      return new Response(
        JSON.stringify({ success: false, error: 'Account pending approval' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { qr_session_id } = await req.json();
    if (!qr_session_id) {
      console.log('No QR session ID provided');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid QR code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Validating QR session: ${qr_session_id}`);

    // Use service role for database operations
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Validate QR session
    const { data: qrSession, error: qrError } = await supabaseAdmin
      .from('qr_sessions')
      .select('*')
      .eq('id', qr_session_id)
      .maybeSingle();

    if (qrError || !qrSession) {
      console.log('QR session not found:', qrError?.message);
      // Still return success to staff - log as incident internally
      await supabaseAdmin.from('attendance_logs').insert({
        staff_id: user.id,
        qr_session_id: qr_session_id,
        status: 'INCIDENT',
      });
      return new Response(
        JSON.stringify({ success: true, timestamp: new Date().toISOString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const validFrom = new Date(qrSession.valid_from);
    const validUntil = new Date(qrSession.valid_until);

    // Check if QR is active and within valid time window
    let isIncident = false;
    let status = '';

    if (!qrSession.active) {
      console.log('QR session is inactive');
      isIncident = true;
    } else if (now < validFrom || now > validUntil) {
      console.log(`QR session expired. Now: ${now}, Valid: ${validFrom} - ${validUntil}`);
      isIncident = true;
    }

    if (!isIncident) {
      // Get last attendance status for this staff
      const { data: lastAttendance } = await supabaseAdmin
        .from('attendance_logs')
        .select('status, scanned_at')
        .eq('staff_id', user.id)
        .neq('status', 'INCIDENT')
        .order('scanned_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log(`Last attendance status: ${lastAttendance?.status || 'none'}`);

      if (qrSession.type === 'CHECK_IN') {
        if (!lastAttendance || lastAttendance.status === 'CHECKED_OUT') {
          status = 'CHECKED_IN';
        } else {
          // Already checked in - incident
          console.log('Staff already checked in - marking as incident');
          isIncident = true;
        }
      } else if (qrSession.type === 'CHECK_OUT') {
        if (lastAttendance?.status === 'CHECKED_IN') {
          status = 'CHECKED_OUT';
        } else {
          // Not checked in or already checked out - incident
          console.log('Staff not checked in or already checked out - marking as incident');
          isIncident = true;
        }
      }
    }

    // Insert attendance log
    const finalStatus = isIncident ? 'INCIDENT' : status;
    console.log(`Recording attendance: ${finalStatus}`);

    const { error: insertError } = await supabaseAdmin
      .from('attendance_logs')
      .insert({
        staff_id: user.id,
        qr_session_id: qr_session_id,
        status: finalStatus,
      });

    if (insertError) {
      console.log('Error inserting attendance log:', insertError.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to record attendance' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Always return success to staff (even for incidents)
    return new Response(
      JSON.stringify({ 
        success: true, 
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing QR scan:', error);
    return new Response(
      JSON.stringify({ success: true, timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
