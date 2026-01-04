import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { BottomNav } from '@/components/BottomNav';
import { PendingApproval } from '@/components/PendingApproval';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Clock, ArrowDownLeft, ArrowUpRight, Calendar } from 'lucide-react';

interface AttendanceLog {
  id: string;
  status: string;
  scanned_at: string;
}

export default function History() {
  const { user, loading, staffProfile } = useAuth();
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  useEffect(() => {
    if (!user || !staffProfile?.approved) return;

    const fetchLogs = async () => {
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;

        const response = await fetch('https://qlobfbzhjtzzdjqxcrhu.supabase.co/functions/v1/get-attendance-history', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        const result = await response.json();

        if (response.ok && result.logs) {
          setLogs(result.logs);
        } else {
          console.error('Error fetching logs:', result.error);
        }
      } catch (error) {
        console.error('Error fetching logs:', error);
      }
      setLoadingLogs(false);
    };

    fetchLogs();
  }, [user, staffProfile]);

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

  // Group logs by date
  const groupedLogs = logs.reduce((groups, log) => {
    const date = new Date(log.scanned_at).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(log);
    return groups;
  }, {} as Record<string, AttendanceLog[]>);

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
              <h1 className="font-semibold text-foreground">Scan History</h1>
              <p className="text-xs text-muted-foreground">Your recent scans</p>
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
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-1">No scans yet</h3>
            <p className="text-sm text-muted-foreground">
              Your scan history will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedLogs).map(([date, dateLogs]) => (
              <div key={date}>
                <h2 className="text-sm font-medium text-muted-foreground mb-3">
                  {date}
                </h2>
                <div className="space-y-2">
                  {dateLogs.map((log) => {
                    const isCheckIn = log.status === 'CHECKED_IN';
                    const time = new Date(log.scanned_at).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={log.id}
                        className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border"
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isCheckIn
                              ? 'bg-success/10 text-success'
                              : 'bg-primary/10 text-primary'
                          }`}
                        >
                          {isCheckIn ? (
                            <ArrowDownLeft className="w-5 h-5" />
                          ) : (
                            <ArrowUpRight className="w-5 h-5" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-foreground">
                            {isCheckIn ? 'Check In' : 'Check Out'}
                          </p>
                          <p className="text-sm text-muted-foreground">{time}</p>
                        </div>
                      </div>
                    );
                  })}
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
