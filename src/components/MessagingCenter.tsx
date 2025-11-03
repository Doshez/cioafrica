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
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MessageSquare, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from './ui/input';

interface MessagingCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

interface ChatRoom {
  id: string;
  name: string | null;
  room_type: 'public' | 'private';
  other_user?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface UserProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string;
}

export const MessagingCenter = ({ open, onOpenChange, projectId }: MessagingCenterProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('public');
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [publicRoom, setPublicRoom] = useState<ChatRoom | null>(null);
  const [privateRooms, setPrivateRooms] = useState<ChatRoom[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const { messages, loading, sendMessage, editMessage, deleteMessage } = useChatMessages(selectedRoom);
  const { presenceMap } = useUserPresence();
  const { unreadCount, unreadByRoom, markRoomAsRead } = useUnreadMessages(projectId);

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
          const { error: upsertError } = await supabase
            .from('chat_participants')
            .upsert(
              { room_id: roomToUse.id, user_id: user.id },
              { onConflict: 'room_id,user_id' }
            );

          if (upsertError) {
            console.error('Error adding participant:', upsertError);
          }
        }
      } catch (error) {
        console.error('Error in fetchOrCreatePublicRoom:', error);
      }
    };

    fetchOrCreatePublicRoom();
  }, [projectId, open, user, toast]);

  // Fetch private rooms with other user details
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

        // For each room, get the other participant's details
        const roomsWithUsers = await Promise.all(
          (rooms || []).map(async (room) => {
            const { data: otherParticipant } = await supabase
              .from('chat_participants')
              .select('user_id')
              .eq('room_id', room.id)
              .neq('user_id', user.id)
              .single();

            if (otherParticipant) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .eq('id', otherParticipant.user_id)
                .single();

              return {
                ...room,
                other_user: profile || undefined,
              };
            }

            return room;
          })
        );

        setPrivateRooms(roomsWithUsers);
      } catch (error) {
        console.error('Error in fetchPrivateRooms:', error);
      }
    };

    fetchPrivateRooms();
  }, [projectId, open, user]);

  // Fetch all users for private messaging (including admins)
  useEffect(() => {
    if (!open || !user) return;

    const fetchAllUsers = async () => {
      try {
        // Fetch all profiles except current user
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, email')
          .neq('id', user.id)
          .order('full_name');

        if (profilesError) {
          console.error('Error fetching users:', profilesError);
          toast({
            title: 'Error loading users',
            description: 'Could not load user list for private messaging',
            variant: 'destructive',
          });
          return;
        }

        console.log('Fetched all users for private chat:', profiles?.length || 0);
        setAllUsers(profiles || []);
      } catch (error) {
        console.error('Error in fetchAllUsers:', error);
      }
    };

    fetchAllUsers();
  }, [open, user, toast]);

  // Auto-select public room when switching to public tab
  useEffect(() => {
    if (activeTab === 'public' && publicRoom) {
      setSelectedRoom(publicRoom.id);
    } else if (activeTab === 'private' && privateRooms.length > 0) {
      setSelectedRoom(privateRooms[0].id);
    }
  }, [activeTab, publicRoom, privateRooms]);

  // Mark room as read when selected
  useEffect(() => {
    if (selectedRoom) {
      markRoomAsRead(selectedRoom);
    }
  }, [selectedRoom]);

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
            // Get other user's profile
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url')
              .eq('id', otherUserId)
              .single();

            // Update the room in state with user info
            const roomWithUser = {
              ...existingRoom,
              other_user: profile || undefined,
            };

            setPrivateRooms((prev) => {
              const index = prev.findIndex(r => r.id === existingRoom.id);
              if (index >= 0) {
                const newRooms = [...prev];
                newRooms[index] = roomWithUser;
                return newRooms;
              }
              return [...prev, roomWithUser];
            });

            setSelectedRoom(existingRoom.id);
            setActiveTab('private');
            return;
          }
        }
      }

      // Get other user's profile first
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', otherUserId)
        .single();

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

      const roomWithUser = {
        ...newRoom,
        other_user: profile || undefined,
      };

      setPrivateRooms((prev) => [...prev, roomWithUser]);
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

  const getSelectedRoomName = () => {
    if (!selectedRoom) return '';
    
    if (activeTab === 'public') {
      return 'Project Chat';
    }
    
    const room = privateRooms.find(r => r.id === selectedRoom);
    if (room?.other_user) {
      return room.other_user.full_name || 'Private Chat';
    }
    
    return 'Private Chat';
  };

  const getSelectedRoomAvatar = () => {
    if (!selectedRoom || activeTab === 'public') return null;
    
    const room = privateRooms.find(r => r.id === selectedRoom);
    return room?.other_user?.avatar_url || null;
  };

  const filteredUsers = allUsers.filter(u =>
    u.full_name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

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
                <TabsTrigger value="public" className="flex-1 relative">
                  <Users className="h-4 w-4 mr-2" />
                  Public
                  {publicRoom && unreadByRoom.get(publicRoom.id) ? (
                    <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1 text-xs">
                      {unreadByRoom.get(publicRoom.id)}
                    </Badge>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="private" className="flex-1 relative">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Private
                  {privateRooms.reduce((sum, room) => sum + (unreadByRoom.get(room.id) || 0), 0) > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1 text-xs">
                      {privateRooms.reduce((sum, room) => sum + (unreadByRoom.get(room.id) || 0), 0)}
                    </Badge>
                  )}
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
                    {privateRooms.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                          CONVERSATIONS
                        </div>
                        {privateRooms.map((room) => {
                          const unread = unreadByRoom.get(room.id) || 0;
                          return (
                            <Button
                              key={room.id}
                              variant={selectedRoom === room.id ? 'secondary' : 'ghost'}
                              className="w-full justify-start gap-2"
                              onClick={() => setSelectedRoom(room.id)}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Avatar className="h-6 w-6 flex-shrink-0">
                                  <AvatarImage src={room.other_user?.avatar_url || undefined} />
                                  <AvatarFallback className="text-xs">
                                    {room.other_user?.full_name?.charAt(0) || 'U'}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="truncate text-sm">
                                  {room.other_user?.full_name || 'Private Chat'}
                                </span>
                              </div>
                              {unread > 0 && (
                                <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs flex-shrink-0">
                                  {unread}
                                </Badge>
                              )}
                            </Button>
                          );
                        })}
                      </>
                    )}

                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-4">
                      START NEW CHAT
                    </div>
                    <div className="px-2 mb-2">
                      <Input
                        placeholder="Search users..."
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    {filteredUsers.map((userProfile) => {
                      const status = getUserStatus(userProfile.id);
                      return (
                        <Button
                          key={userProfile.id}
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => createPrivateChat(userProfile.id)}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <div className="relative">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={userProfile.avatar_url || undefined} />
                                <AvatarFallback>
                                  {userProfile.full_name?.charAt(0) || userProfile.email.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${getStatusColor(status)}`} />
                            </div>
                            <div className="flex flex-col items-start flex-1 min-w-0">
                              <span className="truncate text-sm font-medium">
                                {userProfile.full_name || userProfile.email}
                              </span>
                              {userProfile.full_name && (
                                <span className="truncate text-xs text-muted-foreground">
                                  {userProfile.email}
                                </span>
                              )}
                            </div>
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
                <div className="border-b px-6 py-3 bg-muted/50">
                  <div className="flex items-center gap-3">
                    {getSelectedRoomAvatar() ? (
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={getSelectedRoomAvatar() || undefined} />
                        <AvatarFallback>
                          {getSelectedRoomName().charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    ) : activeTab === 'public' ? (
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <MessageSquare className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold">{getSelectedRoomName()}</h3>
                      <p className="text-xs text-muted-foreground">
                        {activeTab === 'public' ? 'Project team chat' : 'Private conversation'}
                      </p>
                    </div>
                  </div>
                </div>
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
