import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useUserPresence } from '@/hooks/useUserPresence';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MessageSquare, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MessagingCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

interface ChatRoom {
  id: string;
  name: string | null;
  room_type: 'public' | 'private';
}

interface ProjectMember {
  user_id: string;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export const MessagingCenter = ({ open, onOpenChange, projectId }: MessagingCenterProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('public');
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [publicRoom, setPublicRoom] = useState<ChatRoom | null>(null);
  const [privateRooms, setPrivateRooms] = useState<ChatRoom[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const { messages, loading, sendMessage, editMessage, deleteMessage } = useChatMessages(selectedRoom);
  const { presenceMap } = useUserPresence();

  // Fetch or create public chat room
  useEffect(() => {
    if (!projectId || !open) return;

    const fetchPublicRoom = async () => {
      const { data: existingRoom } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('project_id', projectId)
        .eq('room_type', 'public')
        .single();

      if (existingRoom) {
        setPublicRoom(existingRoom);
        // Ensure user is a participant
        await supabase
          .from('chat_participants')
          .upsert({ room_id: existingRoom.id, user_id: user!.id });
      }
    };

    fetchPublicRoom();
  }, [projectId, open, user]);

  // Fetch private rooms
  useEffect(() => {
    if (!projectId || !open) return;

    const fetchPrivateRooms = async () => {
      const { data } = await supabase
        .from('chat_participants')
        .select('room_id, chat_rooms(*)')
        .eq('user_id', user!.id)
        .eq('chat_rooms.room_type', 'private')
        .eq('chat_rooms.project_id', projectId);

      if (data) {
        setPrivateRooms(data.map((d: any) => d.chat_rooms));
      }
    };

    fetchPrivateRooms();
  }, [projectId, open, user]);

  // Fetch project members
  useEffect(() => {
    if (!projectId || !open) return;

    const fetchMembers = async () => {
      const { data } = await supabase
        .from('project_members')
        .select('user_id, profiles(full_name, avatar_url)')
        .eq('project_id', projectId)
        .neq('user_id', user!.id);

      if (data) {
        setProjectMembers(data as any);
      }
    };

    fetchMembers();
  }, [projectId, open, user]);

  // Auto-select public room when switching to public tab
  useEffect(() => {
    if (activeTab === 'public' && publicRoom) {
      setSelectedRoom(publicRoom.id);
    } else if (activeTab === 'private' && privateRooms.length > 0) {
      setSelectedRoom(privateRooms[0].id);
    }
  }, [activeTab, publicRoom, privateRooms]);

  const createPrivateChat = async (otherUserId: string) => {
    // Check if room already exists
    const { data: existingParticipants } = await supabase
      .from('chat_participants')
      .select('room_id, chat_rooms(room_type, project_id)')
      .eq('user_id', user!.id);

    const existingRoom = existingParticipants?.find((p: any) => {
      const room = p.chat_rooms;
      if (room?.room_type !== 'private' || room.project_id !== projectId) return false;

      // Check if other user is also a participant
      return supabase
        .from('chat_participants')
        .select('id')
        .eq('room_id', p.room_id)
        .eq('user_id', otherUserId)
        .single()
        .then((r) => !!r.data);
    });

    if (existingRoom) {
      setSelectedRoom(existingRoom.room_id);
      return;
    }

    // Create new room
    const { data: newRoom, error } = await supabase
      .from('chat_rooms')
      .insert({
        project_id: projectId,
        room_type: 'private',
        created_by: user!.id,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: 'Error creating chat',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    // Add participants
    await supabase.from('chat_participants').insert([
      { room_id: newRoom.id, user_id: user!.id },
      { room_id: newRoom.id, user_id: otherUserId },
    ]);

    setPrivateRooms((prev) => [...prev, newRoom]);
    setSelectedRoom(newRoom.id);
    setActiveTab('private');
  };

  const getUserStatus = (userId: string) => {
    const presence = presenceMap.get(userId);
    if (!presence) return 'offline';
    return presence.status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Messaging Center</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-64 border-r">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="h-full flex flex-col">
              <TabsList className="w-full rounded-none border-b">
                <TabsTrigger value="public" className="flex-1">
                  <Users className="h-4 w-4 mr-2" />
                  Public
                </TabsTrigger>
                <TabsTrigger value="private" className="flex-1">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Private
                </TabsTrigger>
              </TabsList>

              <TabsContent value="public" className="flex-1 m-0 p-4">
                {publicRoom && (
                  <Button
                    variant={selectedRoom === publicRoom.id ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => setSelectedRoom(publicRoom.id)}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Project Chat
                  </Button>
                )}
              </TabsContent>

              <TabsContent value="private" className="flex-1 m-0">
                <ScrollArea className="h-full">
                  <div className="p-2 space-y-2">
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                      CONVERSATIONS
                    </div>
                    {privateRooms.map((room) => (
                      <Button
                        key={room.id}
                        variant={selectedRoom === room.id ? 'secondary' : 'ghost'}
                        className="w-full justify-start"
                        onClick={() => setSelectedRoom(room.id)}
                      >
                        Private Chat
                      </Button>
                    ))}

                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-4">
                      START NEW CHAT
                    </div>
                    {projectMembers.map((member) => {
                      const status = getUserStatus(member.user_id);
                      return (
                        <Button
                          key={member.user_id}
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => createPrivateChat(member.user_id)}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <div className="relative">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={member.profiles?.avatar_url || undefined} />
                                <AvatarFallback>
                                  {member.profiles?.full_name?.charAt(0) || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${getStatusColor(status)}`} />
                            </div>
                            <span className="truncate">{member.profiles?.full_name || 'Unknown'}</span>
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex-1 flex flex-col">
            {selectedRoom ? (
              <>
                <MessageList
                  messages={messages}
                  loading={loading}
                  onEdit={editMessage}
                  onDelete={deleteMessage}
                />
                <MessageInput onSend={sendMessage} />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <p>Select a conversation to start messaging</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
