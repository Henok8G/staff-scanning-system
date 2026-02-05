 import { useState, useEffect } from 'react';
 import { format } from 'date-fns';
 import { CalendarIcon, Send, FileText, User, Loader2 } from 'lucide-react';
 import { useAuth } from '@/hooks/useAuth';
 import { supabase } from '@/integrations/supabase/client';
 import { BottomNav } from '@/components/BottomNav';
 import { PendingApproval } from '@/components/PendingApproval';
 import { Button } from '@/components/ui/button';
 import { Calendar } from '@/components/ui/calendar';
 import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
 import { Textarea } from '@/components/ui/textarea';
 import { Label } from '@/components/ui/label';
 import { Input } from '@/components/ui/input';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { cn } from '@/lib/utils';
 import { useToast } from '@/hooks/use-toast';
 import { Navigate } from 'react-router-dom';
 
 interface Worker {
   id: string;
   name: string;
 }
 
 export default function Permission() {
   const { user, staffProfile, loading } = useAuth();
   const { toast } = useToast();
   const [workers, setWorkers] = useState<Worker[]>([]);
   const [selectedWorker, setSelectedWorker] = useState<string>('');
   const [loadingWorkers, setLoadingWorkers] = useState(true);
   const [date, setDate] = useState<Date>();
   const [time, setTime] = useState<string>('');
   const [reason, setReason] = useState<string>('');
   const [isSubmitting, setIsSubmitting] = useState(false);
 
   useEffect(() => {
     fetchWorkers();
   }, []);
 
   const fetchWorkers = async () => {
     try {
       const { data: { session } } = await supabase.auth.getSession();
       
       if (!session?.access_token) {
         setLoadingWorkers(false);
         return;
       }
 
       const response = await fetch(
         `https://gjovydlrjvogavpsufwc.supabase.co/functions/v1/get-workers`,
         {
           method: 'GET',
           headers: {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${session.access_token}`,
           },
         }
       );
 
       const data = await response.json();
 
       if (response.ok && data.workers) {
         setWorkers(data.workers);
       }
     } catch (error) {
       console.error('Error fetching workers:', error);
     } finally {
       setLoadingWorkers(false);
     }
   };
 
   if (loading) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-background">
         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
       </div>
     );
   }
 
   if (!user) {
     return <Navigate to="/auth" replace />;
   }
 
   if (staffProfile && !staffProfile.approved) {
     return <PendingApproval />;
   }
 
   const handleSubmit = async () => {
     if (!selectedWorker) {
       toast({
         title: "Worker Required",
         description: "Please select a worker for the permission request.",
         variant: "destructive",
       });
       return;
     }
 
     if (!date) {
       toast({
         title: "Date Required",
         description: "Please select a date for your permission request.",
         variant: "destructive",
       });
       return;
     }
 
     setIsSubmitting(true);
 
     try {
       const { data: { session } } = await supabase.auth.getSession();
       
       if (!session?.access_token) {
         throw new Error('Not authenticated');
       }
 
       const selectedWorkerData = workers.find(w => w.id === selectedWorker);
 
       const response = await fetch(
         `https://gjovydlrjvogavpsufwc.supabase.co/functions/v1/submit-permission-request`,
         {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${session.access_token}`,
           },
           body: JSON.stringify({
             staff_id: selectedWorker,
             staff_name: selectedWorkerData?.name || 'Unknown',
             request_date: format(date, 'yyyy-MM-dd'),
             request_time: time || null,
             reason: reason.trim() || null,
           }),
         }
       );
 
       const data = await response.json();
 
       if (!response.ok) {
         throw new Error(data.error || 'Failed to submit request');
       }
 
       toast({
         title: "Request Submitted",
         description: "Your permission request has been sent for approval.",
       });
 
       // Reset form
       setSelectedWorker('');
       setDate(undefined);
       setTime('');
       setReason('');
     } catch (error) {
       console.error('Error submitting permission request:', error);
       toast({
         title: "Submission Failed",
         description: error instanceof Error ? error.message : "Please try again later.",
         variant: "destructive",
       });
     } finally {
       setIsSubmitting(false);
     }
   };
 
   return (
     <div className="min-h-screen bg-background pb-20">
       <div className="p-4 max-w-lg mx-auto">
         <div className="flex items-center gap-3 mb-6">
           <div className="p-2 bg-primary/10 rounded-lg">
             <FileText className="w-6 h-6 text-primary" />
           </div>
           <div>
             <h1 className="text-xl font-bold text-foreground">Permission Request</h1>
             <p className="text-sm text-muted-foreground">Request time off or early leave</p>
           </div>
         </div>
 
         <Card>
           <CardHeader>
             <CardTitle className="text-lg">New Request</CardTitle>
             <CardDescription>
               Select the date and optionally a time for your permission request
             </CardDescription>
           </CardHeader>
           <CardContent className="space-y-4">
             {/* Worker Selection */}
             <div className="space-y-2">
               <Label htmlFor="worker">Worker *</Label>
               {loadingWorkers ? (
                 <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted">
                   <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                   <span className="text-sm text-muted-foreground">Loading workers...</span>
                 </div>
               ) : (
                 <Select value={selectedWorker} onValueChange={setSelectedWorker}>
                   <SelectTrigger id="worker" className="w-full">
                     <SelectValue placeholder="Select a worker">
                       {selectedWorker && (
                         <span className="flex items-center gap-2">
                           <User className="h-4 w-4" />
                           {workers.find(w => w.id === selectedWorker)?.name}
                         </span>
                       )}
                     </SelectValue>
                   </SelectTrigger>
                   <SelectContent className="bg-background border shadow-lg z-50">
                     {workers.length === 0 ? (
                       <div className="p-2 text-sm text-muted-foreground text-center">
                         No workers found
                       </div>
                     ) : (
                       workers.map((worker) => (
                         <SelectItem key={worker.id} value={worker.id}>
                           <span className="flex items-center gap-2">
                             <User className="h-4 w-4" />
                             {worker.name}
                           </span>
                         </SelectItem>
                       ))
                     )}
                   </SelectContent>
                 </Select>
               )}
             </div>
 
             {/* Date Picker */}
             <div className="space-y-2">
               <Label htmlFor="date">Date *</Label>
               <Popover>
                 <PopoverTrigger asChild>
                   <Button
                     id="date"
                     variant="outline"
                     className={cn(
                       "w-full justify-start text-left font-normal",
                       !date && "text-muted-foreground"
                     )}
                   >
                     <CalendarIcon className="mr-2 h-4 w-4" />
                     {date ? format(date, "PPP") : <span>Pick a date</span>}
                   </Button>
                 </PopoverTrigger>
                 <PopoverContent className="w-auto p-0" align="start">
                   <Calendar
                     mode="single"
                     selected={date}
                     onSelect={setDate}
                     disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                     initialFocus
                     className="p-3 pointer-events-auto"
                   />
                 </PopoverContent>
               </Popover>
             </div>
 
             {/* Time Picker (Optional) */}
             <div className="space-y-2">
               <Label htmlFor="time">Time (Optional)</Label>
               <Input
                 id="time"
                 type="time"
                 value={time}
                 onChange={(e) => setTime(e.target.value)}
                 placeholder="Select time"
               />
               <p className="text-xs text-muted-foreground">
                 Leave empty for full day permission
               </p>
             </div>
 
             {/* Reason */}
             <div className="space-y-2">
               <Label htmlFor="reason">Reason (Optional)</Label>
               <Textarea
                 id="reason"
                 value={reason}
                 onChange={(e) => setReason(e.target.value)}
                 placeholder="Why do you need permission?"
                 rows={3}
                 maxLength={500}
               />
               <p className="text-xs text-muted-foreground text-right">
                 {reason.length}/500
               </p>
             </div>
 
             {/* Submit Button */}
             <Button
               onClick={handleSubmit}
               disabled={!selectedWorker || !date || isSubmitting}
               className="w-full"
             >
               {isSubmitting ? (
                 <span className="flex items-center gap-2">
                   <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
                   Submitting...
                 </span>
               ) : (
                 <span className="flex items-center gap-2">
                   <Send className="w-4 h-4" />
                   Submit Request
                 </span>
               )}
             </Button>
           </CardContent>
         </Card>
       </div>
 
       <BottomNav />
     </div>
   );
 }