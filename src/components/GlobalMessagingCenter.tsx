import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import { MessageSquare, Users, Trash2, FolderKanban, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from './ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface GlobalMessagingCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Project {
  id: string;
  name: string;
  logo_url: string | null;
}

interface ChatRoom {
  id: string;
  name: string | null;
  room_type: 'public' | 'private';
  last_message_at?: string | null;
  other_user?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    email?: string;
  };
}

interface UserProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string;
}

export const GlobalMessagingCenter = ({ open, onOpenChange }: GlobalMessagingCenterProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Extract projectId from URL if on a project page
  const urlProjectId = useMemo(() => {
    const match = location.pathname.match(/\/projects\/([^/]+)/);
    return match ? match[1] : null;
  }, [location.pathname]);
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(urlProjectId);
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('public');
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [publicRoom, setPublicRoom] = useState<ChatRoom | null>(null);
  const [privateRooms, setPrivateRooms] = useState<ChatRoom[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [unreadByRoom, setUnreadByRoom] = useState<Map<string, number>>(new Map());
  const [loadingProjects, setLoadingProjects] = useState(true);
  
  const { messages, loading, sendMessage, editMessage, deleteMessage } = useChatMessages(selectedRoom);
  const { presenceMap } = useUserPresence();

  // Update selected project when URL changes
  useEffect(() => {
    if (urlProjectId && open) {
      setSelectedProjectId(urlProjectId);
    }
  }, [urlProjectId, open]);

  // Fetch user's projects
  useEffect(() => {
    if (!open || !user) return;

    const fetchProjects = async () => {
      try {
        setLoadingProjects(true);
        
        // Get projects where user is a member or has tasks
        const { data: memberProjects, error: memberError } = await supabase
          .from('project_members')
          .select('project_id')
          .eq('user_id', user.id);

        if (memberError) {
          console.error('Error fetching member projects:', memberError);
        }

        const { data: taskProjects, error: taskError } = await supabase
          .from('tasks')
          .select('project_id')
          .eq('assignee_user_id', user.id);

        if (taskError) {
          console.error('Error fetching task projects:', taskError);
        }

        // Combine unique project IDs
        const projectIds = new Set<string>();
        memberProjects?.forEach(m => projectIds.add(m.project_id));
        taskProjects?.forEach(t => projectIds.add(t.project_id));

        if (projectIds.size === 0) {
          // Fallback: fetch all projects the user might have access to
          const { data: allProjects } = await supabase
            .from('projects')
            .select('id, name, logo_url')
            .order('name');
          
          setProjects(allProjects || []);
          setLoadingProjects(false);
          return;
        }

        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select('id, name, logo_url')
          .in('id', Array.from(projectIds))
          .order('name');

        if (projectsError) {
          console.error('Error fetching projects:', projectsError);
          return;
        }

        setProjects(projectsData || []);
        
        // Auto-select first project if none selected
        if (!selectedProjectId && projectsData && projectsData.length > 0) {
          setSelectedProjectId(projectsData[0].id);
        }
      } catch (error) {
        console.error('Error in fetchProjects:', error);
      } finally {
        setLoadingProjects(false);
      }
    };

    fetchProjects();
  }, [open, user]);

  // Fetch or create public chat room for selected project
  useEffect(() => {
    if (!selectedProjectId || !open || !user) {
      setPublicRoom(null);
      return;
    }

    const fetchOrCreatePublicRoom = async () => {
      try {
        const { data: existingRoom, error: fetchError } = await supabase
          .from('chat_rooms')
          .select('*')
          .eq('project_id', selectedProjectId)
          .eq('room_type', 'public')
          .maybeSingle();

        if (fetchError) {
          console.error('Error fetching public room:', fetchError);
          return;
        }

        let roomToUse = existingRoom;

        if (!roomToUse) {
          const { data: newRoom, error: createError } = await supabase
            .from('chat_rooms')
            .insert({
              project_id: selectedProjectId,
              room_type: 'public',
              name: 'Project Chat',
              created_by: user.id,
            })
            .select()
            .single();

          if (createError) {
            console.error('Error creating public room:', createError);
            return;
          }
          roomToUse = newRoom;
        }

        if (roomToUse) {
          setPublicRoom(roomToUse);
          await supabase
            .from('chat_participants')
            .upsert(
              { room_id: roomToUse.id, user_id: user.id },
              { onConflict: 'room_id,user_id' }
            );
        }
      } catch (error) {
        console.error('Error in fetchOrCreatePublicRoom:', error);
      }
    };

    fetchOrCreatePublicRoom();
  }, [selectedProjectId, open, user]);

  // Fetch private rooms for selected project
  useEffect(() => {
    if (!selectedProjectId || !open || !user) {
      setPrivateRooms([]);
      return;
    }

    const fetchPrivateRooms = async () => {
      try {
        const { data: participations } = await supabase
          .from('chat_participants')
          .select('room_id')
          .eq('user_id', user.id);

        if (!participations || participations.length === 0) {
          setPrivateRooms([]);
          return;
        }

        const roomIds = participations.map(p => p.room_id);

        const { data: rooms } = await supabase
          .from('chat_rooms')
          .select('*')
          .in('id', roomIds)
          .eq('room_type', 'private')
          .eq('project_id', selectedProjectId);

        const roomsWithUsers = await Promise.all(
          (rooms || []).map(async (room) => {
            const { data: otherParticipant } = await supabase
              .from('chat_participants')
              .select('user_id')
              .eq('room_id', room.id)
              .neq('user_id', user.id)
              .single();

            const { data: lastMessage } = await supabase
              .from('chat_messages')
              .select('created_at')
              .eq('room_id', room.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            let roomData: ChatRoom = {
              ...room,
              last_message_at: lastMessage?.created_at || room.created_at,
            };

            if (otherParticipant) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, email')
                .eq('id', otherParticipant.user_id)
                .single();

              roomData.other_user = profile || undefined;
            }

            return roomData;
          })
        );

        roomsWithUsers.sort((a, b) => {
          const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
          const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
          return timeB - timeA;
        });

        setPrivateRooms(roomsWithUsers);
      } catch (error) {
        console.error('Error in fetchPrivateRooms:', error);
      }
    };

    fetchPrivateRooms();

    // Subscribe to new messages
    const messageChannel = supabase
      .channel(`global-private-rooms-${selectedProjectId}-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        () => fetchPrivateRooms()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
    };
  }, [selectedProjectId, open, user]);

  // Fetch unread counts
  useEffect(() => {
    if (!selectedProjectId || !open || !user) return;

    const fetchUnreadCounts = async () => {
      try {
        const { data: participations } = await supabase
          .from('chat_participants')
          .select('room_id, last_read_at')
          .eq('user_id', user.id);

        if (!participations) return;

        const roomIds = participations.map(p => p.room_id);

        const { data: rooms } = await supabase
          .from('chat_rooms')
          .select('id')
          .eq('project_id', selectedProjectId)
          .in('id', roomIds);

        if (!rooms) return;

        const projectRoomIds = rooms.map(r => r.id);
        const unreadMap = new Map<string, number>();

        for (const participation of participations) {
          if (!projectRoomIds.includes(participation.room_id)) continue;

          const { count } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', participation.room_id)
            .neq('user_id', user.id)
            .gt('created_at', participation.last_read_at || '1970-01-01')
            .is('deleted_at', null);

          unreadMap.set(participation.room_id, count || 0);
        }

        setUnreadByRoom(unreadMap);
      } catch (error) {
        console.error('Error fetching unread counts:', error);
      }
    };

    fetchUnreadCounts();
  }, [selectedProjectId, open, user]);

  // Fetch all users for private messaging
  useEffect(() => {
    if (!open || !user) return;

    const fetchAllUsers = async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, email')
        .neq('id', user.id)
        .order('full_name');

      setAllUsers(profiles || []);
    };

    fetchAllUsers();
  }, [open, user]);

  // Auto-select room when tab changes
  useEffect(() => {
    if (activeTab === 'public' && publicRoom) {
      setSelectedRoom(publicRoom.id);
    } else if (activeTab === 'private' && privateRooms.length > 0) {
      setSelectedRoom(privateRooms[0].id);
    } else {
      setSelectedRoom(null);
    }
  }, [activeTab, publicRoom, privateRooms]);

  // Mark room as read when selected
  const markRoomAsRead = useCallback(async (roomId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('chat_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('room_id', roomId)
        .eq('user_id', user.id);

      setUnreadByRoom(prev => {
        const newMap = new Map(prev);
        newMap.set(roomId, 0);
        return newMap;
      });
    } catch (error) {
      console.error('Error marking room as read:', error);
    }
  }, [user]);

  useEffect(() => {
    if (selectedRoom) {
      markRoomAsRead(selectedRoom);
    }
  }, [selectedRoom, markRoomAsRead]);

  const createPrivateChat = async (otherUserId: string) => {
    if (!user || !selectedProjectId) return;

    try {
      const { data: myParticipations } = await supabase
        .from('chat_participants')
        .select('room_id')
        .eq('user_id', user.id);

      if (myParticipations && myParticipations.length > 0) {
        const roomIds = myParticipations.map(p => p.room_id);

        const { data: otherUserParticipations } = await supabase
          .from('chat_participants')
          .select('room_id')
          .eq('user_id', otherUserId)
          .in('room_id', roomIds);

        if (otherUserParticipations && otherUserParticipations.length > 0) {
          const sharedRoomIds = otherUserParticipations.map(p => p.room_id);
          
          const { data: existingRoom } = await supabase
            .from('chat_rooms')
            .select('*')
            .in('id', sharedRoomIds)
            .eq('room_type', 'private')
            .eq('project_id', selectedProjectId)
            .limit(1)
            .maybeSingle();

          if (existingRoom) {
            setSelectedRoom(existingRoom.id);
            setActiveTab('private');
            return;
          }
        }
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, email')
        .eq('id', otherUserId)
        .single();

      const { data: newRoom, error } = await supabase
        .from('chat_rooms')
        .insert({
          project_id: selectedProjectId,
          room_type: 'private',
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        toast({ title: 'Error creating chat', description: error.message, variant: 'destructive' });
        return;
      }

      await supabase
        .from('chat_participants')
        .insert([
          { room_id: newRoom.id, user_id: user.id },
          { room_id: newRoom.id, user_id: otherUserId },
        ]);

      const roomWithUser: ChatRoom = {
        ...newRoom,
        other_user: profile || undefined,
        last_message_at: newRoom.created_at,
      };

      setPrivateRooms(prev => [roomWithUser, ...prev]);
      setSelectedRoom(newRoom.id);
      setActiveTab('private');
    } catch (error) {
      console.error('Error in createPrivateChat:', error);
      toast({ title: 'Error creating chat', description: 'An unexpected error occurred', variant: 'destructive' });
    }
  };

  const deleteConversation = async (roomId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('chat_rooms')
        .delete()
        .eq('id', roomId);

      if (error) {
        toast({ title: 'Error deleting conversation', description: error.message, variant: 'destructive' });
        return;
      }

      setPrivateRooms(prev => prev.filter(r => r.id !== roomId));
      if (selectedRoom === roomId) {
        setSelectedRoom(null);
      }

      toast({ title: 'Conversation deleted', description: 'The conversation has been removed' });
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const getSelectedRoomName = () => {
    if (!selectedRoom) return '';
    if (activeTab === 'public') return 'Project Chat';
    const room = privateRooms.find(r => r.id === selectedRoom);
    return room?.other_user?.full_name || 'Private Chat';
  };

  const getSelectedRoomAvatar = () => {
    if (!selectedRoom || activeTab === 'public') return null;
    const room = privateRooms.find(r => r.id === selectedRoom);
    return room?.other_user?.avatar_url || null;
  };

  const existingConversationUserIds = privateRooms.map(room => room.other_user?.id).filter(Boolean);

  const filteredUsers = allUsers.filter(u => {
    if (existingConversationUserIds.includes(u.id)) return false;
    return (
      u.full_name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
    );
  });

  const getUserStatus = (userId: string) => presenceMap.get(userId)?.status || 'offline';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle>Messaging Center</DialogTitle>
            
            {/* Project Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 min-w-[200px] justify-between" disabled={loadingProjects}>
                  {loadingProjects ? (
                    <span className="text-muted-foreground">Loading projects...</span>
                  ) : selectedProject ? (
                    <div className="flex items-center gap-2">
                      {selectedProject.logo_url ? (
                        <img src={selectedProject.logo_url} alt="" className="h-5 w-5 object-contain rounded" />
                      ) : (
                        <FolderKanban className="h-4 w-4" />
                      )}
                      <span className="truncate">{selectedProject.name}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Select a project</span>
                  )}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[250px]">
                {projects.map(project => (
                  <DropdownMenuItem
                    key={project.id}
                    onClick={() => setSelectedProjectId(project.id)}
                    className="gap-2"
                  >
                    {project.logo_url ? (
                      <img src={project.logo_url} alt="" className="h-5 w-5 object-contain rounded" />
                    ) : (
                      <FolderKanban className="h-4 w-4" />
                    )}
                    <span className="truncate">{project.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </DialogHeader>

        {!selectedProjectId ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <FolderKanban className="h-12 w-12 mx-auto opacity-50" />
              <p>Select a project to start messaging</p>
            </div>
          </div>
        ) : (
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
                              <div key={room.id} className="relative group">
                                <Button
                                  variant={selectedRoom === room.id ? 'secondary' : 'ghost'}
                                  className="w-full justify-start gap-2 pr-8"
                                  onClick={() => setSelectedRoom(room.id)}
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <Avatar className="h-6 w-6 flex-shrink-0">
                                      <AvatarImage src={room.other_user?.avatar_url || undefined} />
                                      <AvatarFallback className="text-xs">
                                        {(room.other_user?.full_name || room.other_user?.email || 'U').charAt(0).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="truncate text-sm">
                                      {room.other_user?.full_name || room.other_user?.email || 'Unknown User'}
                                    </span>
                                  </div>
                                  {unread > 0 && (
                                    <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs flex-shrink-0">
                                      {unread}
                                    </Badge>
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteConversation(room.id);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
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
        )}
      </DialogContent>
    </Dialog>
  );
};
