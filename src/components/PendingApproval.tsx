import { Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';

export function PendingApproval() {
  const { signOut, refreshProfile, staffProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    setTimeout(() => setRefreshing(false), 500);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm text-center animate-slide-up">
        <div className="w-20 h-20 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-6">
          <Clock className="w-10 h-10 text-warning" />
        </div>
        
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Pending Approval
        </h1>
        
        <p className="text-muted-foreground mb-6">
          Hi {staffProfile?.name || 'there'}, your account is waiting for owner approval. 
          You'll be able to scan once approved.
        </p>

        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Check Status
          </Button>

          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={signOut}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
