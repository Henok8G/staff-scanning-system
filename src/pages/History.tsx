import { useEffect, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { BottomNav } from '@/components/BottomNav';
import { PendingApproval } from '@/components/PendingApproval';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Clock, Calendar, User } from 'lucide-react';

interface AttendanceLog {
  id: string;
  status: string;
  scanned_at: string;
  worker_name?: string | null;
  worker_id?: string | null;
  staff_name?: string | null;
}

interface DayRecord {
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  checkInName: string | null;
  checkOutName: string | null;
}

export default function History() {
  const { user, loading, staffProfile } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [staffName, setStaffName] = useState<string>('');
  const [workerId, setWorkerId] = useState<string>('');
  const [loadingLogs, setLoadingLogs] = useState(true);

  const fetchLogs = useCallback(async () => {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch(
        `https://qlobfbzhjtzzdjqxcrhu.supabase.co/functions/v1/get-attendance-history`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const result = await response.json();

      if (response.ok) {
        setLogs(result.logs || []);
        setStaffName(result.staffName || '');
        setWorkerId(result.workerId || '');
      } else {
        console.error('Error fetching logs:', result.error);
        toast({
          variant: 'destructive',
          title: 'Could not load history',
          description: result?.error || 'Unknown error',
        });
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
    setLoadingLogs(false);
  }, [toast]);

  useEffect(() => {
    if (!user || !staffProfile?.approved) return;
    fetchLogs();
    const onFocus = () => fetchLogs();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user, staffProfile, fetchLogs]);


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!staffProfile?.approved) {
    return <PendingApproval />;
  }

  // Group logs by date and pair check-ins with check-outs
  const dayRecords: DayRecord[] = [];
  const logsByDate = logs.reduce((acc, log) => {
    const dateKey = new Date(log.scanned_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!acc[dateKey]) {
      acc[dateKey] = { checkIn: null, checkOut: null, checkInName: null, checkOutName: null };
    }
    if (log.status === 'CHECKED_IN' && !acc[dateKey].checkIn) {
      acc[dateKey].checkIn = log.scanned_at;
      acc[dateKey].checkInName = log.worker_name ?? log.staff_name ?? null;
    }
    if (log.status === 'CHECKED_OUT' && !acc[dateKey].checkOut) {
      acc[dateKey].checkOut = log.scanned_at;
      acc[dateKey].checkOutName = log.worker_name ?? log.staff_name ?? null;
    }
    return acc;
  }, {} as Record<string, { checkIn: string | null; checkOut: string | null; checkInName: string | null; checkOutName: string | null }>);

  Object.entries(logsByDate).forEach(([date, times]) => {
    dayRecords.push({
      date,
      checkIn: times.checkIn,
      checkOut: times.checkOut,
      checkInName: times.checkInName,
      checkOutName: times.checkOutName,
    });
  });

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '--:--';
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
              <Clock className="w-5 h-5 text-secondary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">Attendance History</h1>
              {staffName && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {staffName}
                  {workerId && (
                    <span className="font-mono ml-1">· {workerId.slice(0, 8)}…</span>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-6">
        {loadingLogs ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : dayRecords.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-1">No attendance records</h3>
            <p className="text-sm text-muted-foreground">
              Your attendance will appear here after scanning
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {dayRecords.map((record) => (
              <div
                key={record.date}
                className="p-4 bg-card rounded-xl border border-border"
              >
                <p className="text-sm font-medium text-muted-foreground mb-3">
                  {record.date}
                </p>
                <div className="flex items-center justify-between">
                  <div className="text-center flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Check In</p>
                    <p className="text-lg font-semibold text-success">
                      {formatTime(record.checkIn)}
                    </p>
                    {record.checkInName && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                        <User className="w-3 h-3" />
                        {record.checkInName}
                      </p>
                    )}
                  </div>
                  <div className="w-px h-10 bg-border" />
                  <div className="text-center flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Check Out</p>
                    <p className="text-lg font-semibold text-primary">
                      {formatTime(record.checkOut)}
                    </p>
                    {record.checkOutName && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                        <User className="w-3 h-3" />
                        {record.checkOutName}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
