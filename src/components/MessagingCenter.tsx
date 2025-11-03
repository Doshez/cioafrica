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
    if (!projectId || !open || !user) return;

    const fetchOrCreatePublicRoom = async () => {
      try {
        // Try to fetch existing public room
        const { data: existingRoom, error: fetchError } = await supabase
          .from('chat_rooms')
          .select('*')
          .eq('project_id', projectId)
          .eq('room_type', 'public')
          .maybeSingle();

        if (fetchError) {
          console.error('Error fetching public room:', fetchError);
          return;
        }

        let roomToUse = existingRoom;

        // Create public room if it doesn't exist
        if (!roomToUse) {
          const { data: newRoom, error: createError } = await supabase
            .from('chat_rooms')
            .insert({
              project_id: projectId,
              room_type: 'public',
              name: 'Project Chat',
              created_by: user.id,
            })
            .select()
            .single();

          if (createError) {
            console.error('Error creating public room:', createError);
            toast({
              title: 'Error creating chat room',
              description: createError.message,
              variant: 'destructive',
            });
            return;
          }
          roomToUse = newRoom;
        }

        if (roomToUse) {
          setPublicRoom(roomToUse);
          // Ensure user is a participant
          await supabase
            .from('chat_participants')
            .upsert({ room_id: roomToUse.id, user_id: user.id }, {
              onConflict: 'room_id,user_id'
            });
        }
      } catch (error) {
        console.error('Error in fetchOrCreatePublicRoom:', error);
      }
    };

    fetchOrCreatePublicRoom();
  }, [projectId, open, user, toast]);

  // Fetch private rooms
  useEffect(() => {
    if (!projectId || !open || !user) return;

    const fetchPrivateRooms = async () => {
      try {
        // Fetch room IDs user is participating in
        const { data: participations, error } = await supabase
          .from('chat_participants')
          .select('room_id')
          .eq('user_id', user.id);

        if (error) {
          console.error('Error fetching participations:', error);
          return;
        }

        if (!participations || participations.length === 0) {
          setPrivateRooms([]);
          return;
        }

        const roomIds = participations.map(p => p.room_id);

        // Fetch the actual room details
        const { data: rooms, error: roomsError } = await supabase
          .from('chat_rooms')
          .select('*')
          .in('id', roomIds)
          .eq('room_type', 'private')
          .eq('project_id', projectId);

        if (roomsError) {
          console.error('Error fetching rooms:', roomsError);
          return;
        }

        setPrivateRooms(rooms || []);
      } catch (error) {
        console.error('Error in fetchPrivateRooms:', error);
      }
    };

    fetchPrivateRooms();
  }, [projectId, open, user]);

  // Fetch project members with profiles
  useEffect(() => {
    if (!projectId || !open || !user) return;

    const fetchMembers = async () => {
      try {
        // Fetch project members
        const { data: members, error: membersError } = await supabase
          .from('project_members')
          .select('user_id')
          .eq('project_id', projectId)
          .neq('user_id', user.id);

        if (membersError) {
          console.error('Error fetching members:', membersError);
          return;
        }

        if (!members || members.length === 0) {
          setProjectMembers([]);
          return;
        }

        const userIds = members.map(m => m.user_id);

        // Fetch profiles for these users
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
          return;
        }

        // Combine members with their profiles
        const membersWithProfiles = members.map(member => ({
          user_id: member.user_id,
          profiles: profiles?.find(p => p.id === member.user_id) || {
            full_name: null,
            avatar_url: null,
          },
        }));

        setProjectMembers(membersWithProfiles);
      } catch (error) {
        console.error('Error in fetchMembers:', error);
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
    if (!user) return;

    try {
      // Fetch all rooms user is participating in
      const { data: myParticipations } = await supabase
        .from('chat_participants')
        .select('room_id')
        .eq('user_id', user.id);

      if (myParticipations && myParticipations.length > 0) {
        const roomIds = myParticipations.map(p => p.room_id);

        // Check if any of these rooms are private rooms with the other user
        const { data: otherUserParticipations } = await supabase
          .from('chat_participants')
          .select('room_id')
          .eq('user_id', otherUserId)
          .in('room_id', roomIds);

        if (otherUserParticipations && otherUserParticipations.length > 0) {
          // Found a shared room, check if it's private and in this project
          const sharedRoomIds = otherUserParticipations.map(p => p.room_id);
          
          const { data: existingRoom } = await supabase
            .from('chat_rooms')
            .select('*')
            .in('id', sharedRoomIds)
            .eq('room_type', 'private')
            .eq('project_id', projectId)
            .limit(1)
            .maybeSingle();

          if (existingRoom) {
            setSelectedRoom(existingRoom.id);
            setActiveTab('private');
            return;
          }
        }
      }

      // Create new room
      const { data: newRoom, error } = await supabase
        .from('chat_rooms')
        .insert({
          project_id: projectId,
          room_type: 'private',
          created_by: user.id,
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
      const { error: participantsError } = await supabase
        .from('chat_participants')
        .insert([
          { room_id: newRoom.id, user_id: user.id },
          { room_id: newRoom.id, user_id: otherUserId },
        ]);

      if (participantsError) {
        console.error('Error adding participants:', participantsError);
        toast({
          title: 'Error adding chat participants',
          description: participantsError.message,
          variant: 'destructive',
        });
        return;
      }

      setPrivateRooms((prev) => [...prev, newRoom]);
      setSelectedRoom(newRoom.id);
      setActiveTab('private');
    } catch (error) {
      console.error('Error in createPrivateChat:', error);
      toast({
        title: 'Error creating chat',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
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
