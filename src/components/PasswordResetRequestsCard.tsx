import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, KeyRound, Send, Clock, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PasswordResetRequest {
  id: string;
  user_email: string;
  user_full_name: string | null;
  status: string;
  requested_at: string;
}

export default function PasswordResetRequestsCard() {
  const [requests, setRequests] = useState<PasswordResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('password_reset_requests')
        .select('*')
        .eq('status', 'pending')
        .order('requested_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error: any) {
      console.error('Error fetching reset requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTemporaryPassword = async (requestId: string, userId: string) => {
    setSending(requestId);
    
    try {
      const { error } = await supabase.functions.invoke('send-temporary-password', {
        body: {
          userId,
          resetRequestId: requestId
        }
      });

      if (error) throw error;

      toast.success('Temporary password sent successfully — user will receive it by email.', {
        icon: <Send className="h-4 w-4" />
      });

      // Refresh the list
      fetchRequests();
    } catch (error: any) {
      console.error('Error sending temporary password:', error);
      toast.error(error.message || 'Failed to send temporary password');
    } finally {
      setSending(null);
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    setDeleting(requestId);
    
    try {
      const { error } = await supabase
        .from('password_reset_requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Password reset request deleted');
      fetchRequests();
    } catch (error: any) {
      console.error('Error deleting request:', error);
      toast.error('Failed to delete request');
    } finally {
      setDeleting(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">Pending</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            <CardTitle>Password Reset Requests</CardTitle>
          </div>
          {requests.length > 0 && (
            <Badge variant="secondary">{requests.length}</Badge>
          )}
        </div>
        <CardDescription>
          Manage user password reset requests — generate and send temporary passwords
        </CardDescription>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No pending password reset requests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium truncate">
                      {request.user_full_name || request.user_email}
                    </p>
                    {getStatusBadge(request.status)}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {request.user_email}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Requested {formatDistanceToNow(new Date(request.requested_at))} ago
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteRequest(request.id)}
                    disabled={deleting === request.id}
                  >
                    {deleting === request.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      // Find the user ID from profiles table
                      supabase
                        .from('profiles')
                        .select('id')
                        .eq('email', request.user_email)
                        .single()
                        .then(({ data, error }) => {
                          if (error || !data) {
                            toast.error('User not found');
                            return;
                          }
                          handleSendTemporaryPassword(request.id, data.id);
                        });
                    }}
                    disabled={sending === request.id}
                  >
                    {sending === request.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Temp Password
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
