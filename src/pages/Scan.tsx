import { useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { QRScanner } from '@/components/QRScanner';
import { SuccessOverlay } from '@/components/SuccessOverlay';
import { BottomNav } from '@/components/BottomNav';
import { PendingApproval } from '@/components/PendingApproval';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ScanLine, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Scan() {
  const { user, loading, staffProfile } = useAuth();
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successTimestamp, setSuccessTimestamp] = useState('');
  const [successWorkerName, setSuccessWorkerName] = useState<string | undefined>();
  const [successWorkerId, setSuccessWorkerId] = useState<string | undefined>();
  const [successStatus, setSuccessStatus] = useState<string | undefined>();
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualQrCode, setManualQrCode] = useState('');

  const handleScan = useCallback(async (scannedData: string) => {
    if (!isScanning) return;
    
    setIsScanning(false);

    try {
      // Parse QR data - expecting just the session ID
      let qrSessionId = scannedData;
      
      // Try to parse as JSON in case it's wrapped
      try {
        const parsed = JSON.parse(scannedData);
        qrSessionId = parsed.qr_session_id || parsed.id || scannedData;
      } catch {
        // Not JSON, use as-is
      }

      // Call the barberflow validate-scan endpoint
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      const response = await fetch('https://qlobfbzhjtzzdjqxcrhu.supabase.co/functions/v1/validate-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ qr_session_id: qrSessionId }),
      });
      
      const result = await response.json();

      if (!response.ok) {
        console.error('Scan error:', result.error);
        toast({
          variant: 'destructive',
          title: 'Scan Failed',
          description: result?.error || 'Unable to process scan. Please try again.',
        });
        setIsScanning(true);
        return;
      }

      if (result?.success) {
        setSuccessTimestamp(result.timestamp);
        setSuccessWorkerName(result.worker_name);
        setSuccessWorkerId(result.worker_id);
        setSuccessStatus(result.status);
        setShowSuccess(true);
      } else {
        toast({
          variant: 'destructive',
          title: 'Scan Error',
          description: result?.error || 'Please try again.',
        });
        setIsScanning(true);
      }
    } catch (err) {
      console.error('Scan error:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Something went wrong. Please try again.',
      });
      setIsScanning(true);
    }
  }, [isScanning, toast]);

  const handleSuccessClose = useCallback(() => {
    setShowSuccess(false);
    setIsScanning(true);
    setManualQrCode('');
    setShowManualInput(false);
  }, []);

  const handleManualSubmit = useCallback(() => {
    if (manualQrCode.trim()) {
      handleScan(manualQrCode.trim());
    }
  }, [manualQrCode, handleScan]);

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

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <ScanLine className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">QR Scanner</h1>
              <p className="text-xs text-muted-foreground">Hi, {staffProfile.name}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Scanner */}
      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="mb-6 text-center">
          <p className="text-muted-foreground">
            Position the QR code within the frame to scan
          </p>
        </div>

        {!showManualInput ? (
          <>
            <QRScanner onScan={handleScan} isScanning={isScanning} />
            
            <Button 
              variant="outline" 
              onClick={() => setShowManualInput(true)}
              className="w-full mt-4"
            >
              <Keyboard className="w-4 h-4 mr-2" />
              Enter QR Code Manually
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-3">
                Paste or type the QR code content below:
              </p>
              <Input
                value={manualQrCode}
                onChange={(e) => setManualQrCode(e.target.value)}
                placeholder="Enter QR code..."
                className="mb-3"
              />
              <div className="flex gap-2">
                <Button 
                  onClick={handleManualSubmit}
                  disabled={!manualQrCode.trim() || !isScanning}
                  className="flex-1"
                >
                  Submit
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setShowManualInput(false);
                    setManualQrCode('');
                  }}
                >
                  Cancel
                </Button>
              </div>
              {!isScanning && (
                <div className="flex items-center justify-center mt-4">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Processing...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Success Overlay */}
      {showSuccess && (
        <SuccessOverlay
          timestamp={successTimestamp}
          onClose={handleSuccessClose}
        />
      )}

      <BottomNav />
    </div>
  );
}
