import { useEffect } from 'react';
import { Check } from 'lucide-react';

interface SuccessOverlayProps {
  timestamp: string;
  onClose: () => void;
  workerName?: string;
  workerId?: string;
  status?: string;
}

export function SuccessOverlay({ timestamp, onClose, workerName, workerId, status }: SuccessOverlayProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 2500);

    return () => clearTimeout(timer);
  }, [onClose]);

  const formattedTime = new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const formattedDate = new Date(timestamp).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm animate-scale-in">
      <div className="flex flex-col items-center text-center p-8">
        <div className="w-28 h-28 rounded-full gradient-success flex items-center justify-center mb-6 shadow-lg animate-check">
          <Check className="w-14 h-14 text-success-foreground" strokeWidth={3} />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Scan Recorded
        </h2>
        <p className="text-lg text-muted-foreground mb-1">{formattedDate}</p>
        <p className="text-3xl font-mono font-semibold text-foreground">
          {formattedTime}
        </p>
        {workerName && (
          <p className="mt-4 text-base font-medium text-foreground">{workerName}</p>
        )}
        {status && (
          <p className="text-sm text-muted-foreground">{status.replace('_', ' ')}</p>
        )}
        {workerId && (
          <p className="mt-1 text-xs font-mono text-muted-foreground">{workerId.slice(0, 8)}…</p>
        )}
      </div>
    </div>
  );
}
