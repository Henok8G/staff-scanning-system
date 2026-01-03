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
    
    // Create client with user's auth context - RLS will handle permissions
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

    // Validate QR session (RLS allows authenticated users to read qr_sessions)
    const { data: qrSession, error: qrError } = await supabase
      .from('qr_sessions')
      .select('*')
      .eq('id', qr_session_id)
      .maybeSingle();

    if (qrError || !qrSession) {
      console.log('QR session not found:', qrError?.message);
      // Log as incident - staff can insert their own logs via RLS
      await supabase.from('attendance_logs').insert({
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
      // Use the database function to get last attendance status
      const { data: lastAttendanceData, error: lastAttendanceError } = await supabase
        .rpc('get_last_attendance_status', { p_staff_id: user.id });

      const lastAttendance = lastAttendanceData?.[0] || null;
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

    // Insert attendance log - RLS allows staff to insert their own logs
    const finalStatus = isIncident ? 'INCIDENT' : status;
    console.log(`Recording attendance: ${finalStatus}`);

    const { error: insertError } = await supabase
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