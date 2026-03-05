import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Dialog, DialogContent } from './ui/dialog';
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
import {
  MessageSquare, Users, Trash2, Hash, Plus, Search, X,
  FileText, UserPlus, Building2, ChevronRight, Smile
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from './ui/input';
import { Separator } from './ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './ui/tooltip';
import { formatDistanceToNow } from 'date-fns';

interface MessagingCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

interface ChatRoom {
  id: string;
  name: string | null;
  room_type: string;
  department_id?: string | null;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  created_at?: string | null;
  other_user?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    email?: string;
  };
  participants?: Array<{
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  }>;
}

interface UserProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string;
}

interface Department {
  id: string;
  name: string;
}

export const MessagingCenter = ({ open, onOpenChange, projectId }: MessagingCenterProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [publicRoom, setPublicRoom] = useState<ChatRoom | null>(null);
  const [privateRooms, setPrivateRooms] = useState<ChatRoom[]>([]);
  const [departmentRooms, setDepartmentRooms] = useState<ChatRoom[]>([]);
  const [groupRooms, setGroupRooms] = useState<ChatRoom[]>([]);
  const [projectUsers, setProjectUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [selectedGroupUsers, setSelectedGroupUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [newChatSearch, setNewChatSearch] = useState('');
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [reactions, setReactions] = useState<Map<string, Array<{ emoji: string; user_id: string; id: string }>>>(new Map());
  
  const { messages, loading, sendMessage, editMessage, deleteMessage } = useChatMessages(selectedRoom);
  const { presenceMap } = useUserPresence();
  const { unreadByRoom, markRoomAsRead } = useUnreadMessages(projectId);

  // Fetch project members only (strict project scoping)
  useEffect(() => {
    if (!open || !user || !projectId) return;

    const fetchProjectUsers = async () => {
      try {
        // Get project members
        const { data: members } = await supabase
          .from('project_members')
          .select('user_id')
          .eq('project_id', projectId);

        // Get project owner
        const { data: project } = await supabase
          .from('projects')
          .select('owner_id')
          .eq('id', projectId)
          .single();

        const userIds = new Set<string>();
        members?.forEach(m => userIds.add(m.user_id));
        if (project?.owner_id) userIds.add(project.owner_id);
        userIds.delete(user.id); // Exclude current user

        if (userIds.size === 0) {
          setProjectUsers([]);
          return;
        }

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, email')
          .in('id', Array.from(userIds))
          .order('full_name');

        setProjectUsers(profiles || []);
      } catch (error) {
        console.error('Error fetching project users:', error);
      }
    };

    fetchProjectUsers();
  }, [open, user, projectId]);

  // Fetch departments for the project
  useEffect(() => {
    if (!open || !projectId) return;

    const fetchDepartments = async () => {
      const { data } = await supabase
        .from('departments')
        .select('id, name')
        .eq('project_id', projectId)
        .order('name');
      setDepartments(data || []);
    };

    fetchDepartments();
  }, [open, projectId]);

  // Fetch or create public room
  useEffect(() => {
    if (!projectId || !open || !user) return;

    const fetchOrCreatePublicRoom = async () => {
      try {
        const { data: existingRoom } = await supabase
          .from('chat_rooms')
          .select('*')
          .eq('project_id', projectId)
          .eq('room_type', 'public')
          .maybeSingle();

        let roomToUse = existingRoom;

        if (!roomToUse) {
          const { data: newRoom, error } = await supabase
            .from('chat_rooms')
            .insert({
              project_id: projectId,
              room_type: 'public',
              name: 'General',
              created_by: user.id,
            })
            .select()
            .single();

          if (error) {
            console.error('Error creating public room:', error);
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
          
          // Auto-select if nothing selected
          if (!selectedRoom) {
            setSelectedRoom(roomToUse.id);
          }
        }
      } catch (error) {
        console.error('Error in fetchOrCreatePublicRoom:', error);
      }
    };

    fetchOrCreatePublicRoom();
  }, [projectId, open, user]);

  // Fetch department channels
  useEffect(() => {
    if (!projectId || !open || !user) return;

    const fetchDepartmentRooms = async () => {
      try {
      const { data: rooms } = await supabase
          .from('chat_rooms')
          .select('*')
          .eq('project_id', projectId)
          .eq('room_type', 'department' as any);

        setDepartmentRooms(rooms || []);
      } catch (error) {
        console.error('Error fetching department rooms:', error);
      }
    };

    fetchDepartmentRooms();
  }, [projectId, open, user]);

  // Fetch private & group rooms
  useEffect(() => {
    if (!projectId || !open || !user) return;

    const fetchRooms = async () => {
      try {
        const { data: participations } = await supabase
          .from('chat_participants')
          .select('room_id')
          .eq('user_id', user.id);

        if (!participations || participations.length === 0) {
          setPrivateRooms([]);
          setGroupRooms([]);
          return;
        }

        const roomIds = participations.map(p => p.room_id);

        // Private rooms
        const { data: privRooms } = await supabase
          .from('chat_rooms')
          .select('*')
          .in('id', roomIds)
          .eq('room_type', 'private')
          .eq('project_id', projectId);

        const privateWithUsers = await Promise.all(
          (privRooms || []).map(async (room) => {
            const { data: otherParticipant } = await supabase
              .from('chat_participants')
              .select('user_id')
              .eq('room_id', room.id)
              .neq('user_id', user.id)
              .single();

            let roomData: ChatRoom = { ...room };

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

        privateWithUsers.sort((a, b) => {
          const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
          const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
          return timeB - timeA;
        });

        setPrivateRooms(privateWithUsers);

        // Group rooms
        const { data: grpRooms } = await supabase
          .from('chat_rooms')
          .select('*')
          .in('id', roomIds)
          .eq('room_type', 'group' as any)
          .eq('project_id', projectId);

        setGroupRooms(grpRooms || []);
      } catch (error) {
        console.error('Error fetching rooms:', error);
      }
    };

    fetchRooms();

    // Realtime subscription
    const channel = supabase
      .channel(`messaging-${projectId}-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
        fetchRooms();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_participants', filter: `user_id=eq.${user.id}` }, () => {
        fetchRooms();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectId, open, user]);

  // Fetch reactions for current room messages
  useEffect(() => {
    if (!selectedRoom || !messages.length) return;

    const fetchReactions = async () => {
      const msgIds = messages.map(m => m.id);
      const { data } = await supabase
        .from('message_reactions')
        .select('*')
        .in('message_id', msgIds);

      const map = new Map<string, Array<{ emoji: string; user_id: string; id: string }>>();
      data?.forEach(r => {
        const existing = map.get(r.message_id) || [];
        existing.push({ emoji: r.emoji, user_id: r.user_id, id: r.id });
        map.set(r.message_id, existing);
      });
      setReactions(map);
    };

    fetchReactions();
  }, [selectedRoom, messages]);

  // Mark room as read
  useEffect(() => {
    if (selectedRoom) {
      markRoomAsRead(selectedRoom);
    }
  }, [selectedRoom]);

  const createPrivateChat = async (otherUserId: string) => {
    if (!user) return;

    try {
      // Check for existing private chat
      const { data: myParticipations } = await supabase
        .from('chat_participants')
        .select('room_id')
        .eq('user_id', user.id);

      if (myParticipations && myParticipations.length > 0) {
        const roomIds = myParticipations.map(p => p.room_id);
        const { data: otherUserParts } = await supabase
          .from('chat_participants')
          .select('room_id')
          .eq('user_id', otherUserId)
          .in('room_id', roomIds);

        if (otherUserParts && otherUserParts.length > 0) {
          const sharedRoomIds = otherUserParts.map(p => p.room_id);
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
            setShowNewChat(false);
            return;
          }
        }
      }

      const { data: newRoom, error } = await supabase
        .from('chat_rooms')
        .insert({ project_id: projectId, room_type: 'private', created_by: user.id })
        .select()
        .single();

      if (error) {
        toast({ title: 'Error creating chat', description: error.message, variant: 'destructive' });
        return;
      }

      await supabase.from('chat_participants').insert([
        { room_id: newRoom.id, user_id: user.id },
        { room_id: newRoom.id, user_id: otherUserId },
      ]);

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, email')
        .eq('id', otherUserId)
        .single();

      const roomWithUser: ChatRoom = { ...newRoom, other_user: profile || undefined };
      setPrivateRooms(prev => [roomWithUser, ...prev]);
      setSelectedRoom(newRoom.id);
      setShowNewChat(false);
    } catch (error) {
      console.error('Error creating private chat:', error);
    }
  };

  const createGroupChat = async () => {
    if (!user || selectedGroupUsers.length < 2 || !groupName.trim()) return;

    try {
      const { data: newRoom, error } = await supabase
        .from('chat_rooms')
        .insert({
          project_id: projectId,
          room_type: 'group' as any,
          name: groupName.trim(),
          created_by: user.id,
        } as any)
        .select()
        .single();

      if (error) {
        toast({ title: 'Error creating group', description: error.message, variant: 'destructive' });
        return;
      }

      const participants = [user.id, ...selectedGroupUsers].map(uid => ({
        room_id: newRoom.id,
        user_id: uid,
      }));

      await supabase.from('chat_participants').insert(participants);

      setGroupRooms(prev => [newRoom, ...prev]);
      setSelectedRoom(newRoom.id);
      setShowNewGroup(false);
      setSelectedGroupUsers([]);
      setGroupName('');
      toast({ title: 'Group created', description: `${groupName} group chat created` });
    } catch (error) {
      console.error('Error creating group:', error);
    }
  };

  const createDepartmentChannel = async (dept: Department) => {
    if (!user) return;

    // Check if channel already exists
    const existing = departmentRooms.find(r => r.department_id === dept.id);
    if (existing) {
      setSelectedRoom(existing.id);
      return;
    }

    try {
      const { data: newRoom, error } = await supabase
        .from('chat_rooms')
        .insert({
          project_id: projectId,
          room_type: 'department' as any,
          name: dept.name,
          department_id: dept.id,
          created_by: user.id,
        } as any)
        .select()
        .single();

      if (error) {
        toast({ title: 'Error creating channel', description: error.message, variant: 'destructive' });
        return;
      }

      // Add current user as participant
      await supabase.from('chat_participants').upsert(
        { room_id: newRoom.id, user_id: user.id },
        { onConflict: 'room_id,user_id' }
      );

      setDepartmentRooms(prev => [...prev, newRoom]);
      setSelectedRoom(newRoom.id);
    } catch (error) {
      console.error('Error creating department channel:', error);
    }
  };

  const deleteConversation = async (roomId: string) => {
    try {
      const { error } = await supabase.from('chat_rooms').delete().eq('id', roomId);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      setPrivateRooms(prev => prev.filter(r => r.id !== roomId));
      setGroupRooms(prev => prev.filter(r => r.id !== roomId));
      if (selectedRoom === roomId) setSelectedRoom(null);
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;

    const messageReactions = reactions.get(messageId) || [];
    const existing = messageReactions.find(r => r.emoji === emoji && r.user_id === user.id);

    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id);
      setReactions(prev => {
        const newMap = new Map(prev);
        const updated = (newMap.get(messageId) || []).filter(r => r.id !== existing.id);
        newMap.set(messageId, updated);
        return newMap;
      });
    } else {
      const { data } = await supabase
        .from('message_reactions')
        .insert({ message_id: messageId, user_id: user.id, emoji })
        .select()
        .single();

      if (data) {
        setReactions(prev => {
          const newMap = new Map(prev);
          const updated = [...(newMap.get(messageId) || []), { emoji: data.emoji, user_id: data.user_id, id: data.id }];
          newMap.set(messageId, updated);
          return newMap;
        });
      }
    }
  };

  const getUserStatus = (userId: string) => presenceMap.get(userId)?.status || 'offline';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-amber-500';
      case 'busy': return 'bg-red-500';
      default: return 'bg-muted-foreground/30';
    }
  };

  const getSelectedRoomInfo = () => {
    if (!selectedRoom) return { name: '', type: '', avatar: null as string | null };
    
    if (publicRoom?.id === selectedRoom) return { name: 'General', type: 'Project channel', avatar: null };
    
    const dept = departmentRooms.find(r => r.id === selectedRoom);
    if (dept) return { name: dept.name || 'Department', type: 'Department channel', avatar: null };

    const group = groupRooms.find(r => r.id === selectedRoom);
    if (group) return { name: group.name || 'Group', type: 'Group chat', avatar: null };

    const priv = privateRooms.find(r => r.id === selectedRoom);
    if (priv?.other_user) return {
      name: priv.other_user.full_name || priv.other_user.email || 'User',
      type: getUserStatus(priv.other_user.id) === 'online' ? 'Online' : 'Offline',
      avatar: priv.other_user.avatar_url
    };

    return { name: 'Chat', type: '', avatar: null };
  };

  // Filter conversations by search
  const filteredPrivateRooms = privateRooms.filter(r => {
    if (!searchQuery) return true;
    const name = r.other_user?.full_name || r.other_user?.email || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredNewChatUsers = projectUsers.filter(u => {
    const existingIds = privateRooms.map(r => r.other_user?.id).filter(Boolean);
    if (existingIds.includes(u.id)) return false;
    if (!newChatSearch) return true;
    return (
      u.full_name?.toLowerCase().includes(newChatSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(newChatSearch.toLowerCase())
    );
  });

  const roomInfo = getSelectedRoomInfo();
  const quickEmojis = ['👍', '❤️', '🔥', '✅', '🎉', '😂'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* No header - full chat layout */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* ===== LEFT PANEL - Conversations ===== */}
          <div className="w-72 border-r bg-muted/30 flex flex-col flex-shrink-0">
            {/* Header */}
            <div className="p-4 pb-3 border-b">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold">Messages</h2>
                <div className="flex gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setShowNewChat(true); setShowNewGroup(false); }}>
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>New message</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setShowNewGroup(true); setShowNewChat(false); }}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>New group</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-sm bg-background"
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2">
                {/* Channels */}
                <div className="mb-3">
                  <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Channels
                  </div>
                  
                  {/* General / Public */}
                  {publicRoom && (
                    <button
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                        selectedRoom === publicRoom.id
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-muted text-foreground'
                      }`}
                      onClick={() => setSelectedRoom(publicRoom.id)}
                    >
                      <Hash className="h-4 w-4 flex-shrink-0 opacity-60" />
                      <span className="truncate flex-1 text-left">General</span>
                      {(unreadByRoom.get(publicRoom.id) || 0) > 0 && (
                        <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">
                          {unreadByRoom.get(publicRoom.id)}
                        </Badge>
                      )}
                    </button>
                  )}

                  {/* Department channels */}
                  {departmentRooms.map(room => (
                    <button
                      key={room.id}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                        selectedRoom === room.id
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-muted text-foreground'
                      }`}
                      onClick={() => setSelectedRoom(room.id)}
                    >
                      <Building2 className="h-4 w-4 flex-shrink-0 opacity-60" />
                      <span className="truncate flex-1 text-left">{room.name}</span>
                      {(unreadByRoom.get(room.id) || 0) > 0 && (
                        <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">
                          {unreadByRoom.get(room.id)}
                        </Badge>
                      )}
                    </button>
                  ))}

                  {/* Departments without channels */}
                  {departments
                    .filter(d => !departmentRooms.find(r => r.department_id === d.id))
                    .map(dept => (
                      <button
                        key={dept.id}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm hover:bg-muted text-muted-foreground transition-colors"
                        onClick={() => createDepartmentChannel(dept)}
                      >
                        <Building2 className="h-4 w-4 flex-shrink-0 opacity-40" />
                        <span className="truncate flex-1 text-left">{dept.name}</span>
                        <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                      </button>
                    ))
                  }
                </div>

                {/* Group Chats */}
                {groupRooms.length > 0 && (
                  <div className="mb-3">
                    <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Groups
                    </div>
                    {groupRooms.map(room => (
                      <div key={room.id} className="relative group">
                        <button
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                            selectedRoom === room.id
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'hover:bg-muted text-foreground'
                          }`}
                          onClick={() => setSelectedRoom(room.id)}
                        >
                          <Users className="h-4 w-4 flex-shrink-0 opacity-60" />
                          <span className="truncate flex-1 text-left">{room.name || 'Group'}</span>
                          {(unreadByRoom.get(room.id) || 0) > 0 && (
                            <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">
                              {unreadByRoom.get(room.id)}
                            </Badge>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <Separator className="my-2" />

                {/* Direct Messages */}
                <div>
                  <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Direct Messages
                  </div>
                  {filteredPrivateRooms.map(room => {
                    const unread = unreadByRoom.get(room.id) || 0;
                    const otherUserId = room.other_user?.id;
                    const status = otherUserId ? getUserStatus(otherUserId) : 'offline';

                    return (
                      <div key={room.id} className="relative group">
                        <button
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                            selectedRoom === room.id
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'hover:bg-muted text-foreground'
                          }`}
                          onClick={() => setSelectedRoom(room.id)}
                        >
                          <div className="relative flex-shrink-0">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={room.other_user?.avatar_url || undefined} />
                              <AvatarFallback className="text-[10px]">
                                {(room.other_user?.full_name || room.other_user?.email || 'U').charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${getStatusColor(status)}`} />
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center justify-between">
                              <span className={`truncate text-sm ${unread > 0 ? 'font-semibold' : ''}`}>
                                {room.other_user?.full_name || room.other_user?.email || 'User'}
                              </span>
                            </div>
                            {room.last_message_preview && (
                              <p className="text-xs text-muted-foreground truncate">{room.last_message_preview}</p>
                            )}
                          </div>
                          {unread > 0 && (
                            <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px] flex-shrink-0">
                              {unread}
                            </Badge>
                          )}
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); deleteConversation(room.id); }}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}

                  {filteredPrivateRooms.length === 0 && !searchQuery && (
                    <p className="text-xs text-muted-foreground px-2.5 py-2">
                      No conversations yet
                    </p>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* ===== CENTER PANEL - Chat ===== */}
          <div className="flex-1 flex flex-col min-w-0">
            {showNewChat ? (
              /* New Chat - User selection */
              <div className="flex-1 flex flex-col">
                <div className="border-b px-4 py-3 flex items-center justify-between">
                  <h3 className="font-semibold">New Message</h3>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowNewChat(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="p-4">
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search project members..."
                      value={newChatSearch}
                      onChange={(e) => setNewChatSearch(e.target.value)}
                      className="pl-10"
                      autoFocus
                    />
                  </div>
                  <ScrollArea className="h-[calc(100vh-280px)]">
                    <div className="space-y-1">
                      {filteredNewChatUsers.map(userProfile => {
                        const status = getUserStatus(userProfile.id);
                        return (
                          <button
                            key={userProfile.id}
                            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                            onClick={() => createPrivateChat(userProfile.id)}
                          >
                            <div className="relative">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={userProfile.avatar_url || undefined} />
                                <AvatarFallback>
                                  {userProfile.full_name?.charAt(0) || userProfile.email.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${getStatusColor(status)}`} />
                            </div>
                            <div className="text-left">
                              <p className="font-medium text-sm">{userProfile.full_name || userProfile.email}</p>
                              {userProfile.full_name && (
                                <p className="text-xs text-muted-foreground">{userProfile.email}</p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                      {filteredNewChatUsers.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No project members available
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            ) : showNewGroup ? (
              /* New Group - Multi-user selection */
              <div className="flex-1 flex flex-col">
                <div className="border-b px-4 py-3 flex items-center justify-between">
                  <h3 className="font-semibold">New Group Chat</h3>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setShowNewGroup(false); setSelectedGroupUsers([]); setGroupName(''); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="p-4 space-y-4">
                  <Input
                    placeholder="Group name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    autoFocus
                  />

                  {/* Selected users tags */}
                  {selectedGroupUsers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedGroupUsers.map(uid => {
                        const u = projectUsers.find(p => p.id === uid);
                        return (
                          <Badge key={uid} variant="secondary" className="gap-1 pl-2">
                            {u?.full_name || u?.email || 'User'}
                            <button onClick={() => setSelectedGroupUsers(prev => prev.filter(id => id !== uid))}>
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Add members..."
                      value={newChatSearch}
                      onChange={(e) => setNewChatSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <ScrollArea className="h-[calc(100vh-440px)]">
                    <div className="space-y-1">
                      {projectUsers
                        .filter(u => {
                          if (selectedGroupUsers.includes(u.id)) return false;
                          if (!newChatSearch) return true;
                          return u.full_name?.toLowerCase().includes(newChatSearch.toLowerCase()) ||
                            u.email.toLowerCase().includes(newChatSearch.toLowerCase());
                        })
                        .map(userProfile => (
                          <button
                            key={userProfile.id}
                            className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted transition-colors"
                            onClick={() => setSelectedGroupUsers(prev => [...prev, userProfile.id])}
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={userProfile.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {userProfile.full_name?.charAt(0) || userProfile.email.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{userProfile.full_name || userProfile.email}</span>
                          </button>
                        ))
                      }
                    </div>
                  </ScrollArea>

                  <Button
                    className="w-full"
                    onClick={createGroupChat}
                    disabled={selectedGroupUsers.length < 2 || !groupName.trim()}
                  >
                    Create Group ({selectedGroupUsers.length} members)
                  </Button>
                </div>
              </div>
            ) : selectedRoom ? (
              /* Active Chat */
              <>
                <div className="border-b px-4 py-3 bg-card flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    {roomInfo.avatar ? (
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={roomInfo.avatar} />
                        <AvatarFallback className="text-sm">{roomInfo.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {publicRoom?.id === selectedRoom ? (
                          <Hash className="h-4 w-4 text-primary" />
                        ) : departmentRooms.find(r => r.id === selectedRoom) ? (
                          <Building2 className="h-4 w-4 text-primary" />
                        ) : groupRooms.find(r => r.id === selectedRoom) ? (
                          <Users className="h-4 w-4 text-primary" />
                        ) : (
                          <MessageSquare className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate">{roomInfo.name}</h3>
                      <p className="text-xs text-muted-foreground">{roomInfo.type}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowRightPanel(!showRightPanel)}
                  >
                    <ChevronRight className={`h-4 w-4 transition-transform ${showRightPanel ? 'rotate-180' : ''}`} />
                  </Button>
                </div>

                {/* Messages with reactions */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {loading ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <p className="text-sm">Loading messages...</p>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center space-y-2">
                        <MessageSquare className="h-10 w-10 mx-auto opacity-30" />
                        <p className="text-sm">No messages yet. Start the conversation!</p>
                      </div>
                    </div>
                  ) : (
                    messages.map((message) => {
                      const isOwn = message.user_id === user?.id;
                      const userName = message.user?.full_name || message.user_email || 'Unknown';
                      const msgReactions = reactions.get(message.id) || [];

                      // Group reactions by emoji
                      const groupedReactions: { emoji: string; count: number; hasOwn: boolean }[] = [];
                      msgReactions.forEach(r => {
                        const existing = groupedReactions.find(g => g.emoji === r.emoji);
                        if (existing) {
                          existing.count++;
                          if (r.user_id === user?.id) existing.hasOwn = true;
                        } else {
                          groupedReactions.push({ emoji: r.emoji, count: 1, hasOwn: r.user_id === user?.id });
                        }
                      });

                      return (
                        <div key={message.id} className={`flex gap-3 group ${isOwn ? 'flex-row-reverse' : ''}`}>
                          <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
                            <AvatarImage src={message.user?.avatar_url || undefined} />
                            <AvatarFallback className="text-[10px]">{userName.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className={`max-w-[65%] ${isOwn ? 'text-right' : ''}`}>
                            <div className={`flex items-center gap-2 mb-0.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
                              <span className="text-xs font-medium">{userName}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                              </span>
                            </div>
                            <div className={`inline-block rounded-2xl px-3.5 py-2 text-sm ${
                              isOwn
                                ? 'bg-primary text-primary-foreground rounded-br-md'
                                : 'bg-muted rounded-bl-md'
                            }`}>
                              <p className="whitespace-pre-wrap break-words">{message.content}</p>

                              {message.attachment_url && (
                                <a
                                  href={message.attachment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-xs mt-1.5 hover:underline opacity-80"
                                >
                                  <FileText className="h-3 w-3" />
                                  {message.attachment_name}
                                </a>
                              )}

                              {message.edited_at && (
                                <p className="text-[10px] opacity-60 mt-0.5">(edited)</p>
                              )}
                            </div>

                            {/* Reactions */}
                            {groupedReactions.length > 0 && (
                              <div className={`flex gap-1 mt-1 flex-wrap ${isOwn ? 'justify-end' : ''}`}>
                                {groupedReactions.map(gr => (
                                  <button
                                    key={gr.emoji}
                                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                                      gr.hasOwn ? 'bg-primary/10 border-primary/30' : 'bg-muted border-transparent hover:border-border'
                                    }`}
                                    onClick={() => toggleReaction(message.id, gr.emoji)}
                                  >
                                    {gr.emoji} {gr.count > 1 && <span className="text-[10px]">{gr.count}</span>}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Quick reaction bar on hover */}
                            <div className={`flex gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${isOwn ? 'justify-end' : ''}`}>
                              {quickEmojis.map(emoji => (
                                <button
                                  key={emoji}
                                  className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center text-xs"
                                  onClick={() => toggleReaction(message.id, emoji)}
                                >
                                  {emoji}
                                </button>
                              ))}
                              {isOwn && (
                                <>
                                  <button
                                    className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center"
                                    onClick={() => {
                                      const newContent = prompt('Edit message:', message.content);
                                      if (newContent && newContent !== message.content) editMessage(message.id, newContent);
                                    }}
                                  >
                                    <span className="text-[10px]">✏️</span>
                                  </button>
                                  <button
                                    className="h-6 w-6 rounded hover:bg-destructive/10 flex items-center justify-center"
                                    onClick={() => {
                                      if (confirm('Delete this message?')) deleteMessage(message.id);
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <MessageInput onSend={sendMessage} />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center space-y-3">
                  <MessageSquare className="h-12 w-12 mx-auto opacity-20" />
                  <p className="text-sm">Select a conversation or start a new one</p>
                </div>
              </div>
            )}
          </div>

          {/* ===== RIGHT PANEL - Details ===== */}
          {showRightPanel && selectedRoom && (
            <div className="w-64 border-l bg-muted/20 flex flex-col flex-shrink-0">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-sm">Details</h3>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  {/* Room info */}
                  <div className="text-center">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                      {roomInfo.avatar ? (
                        <Avatar className="h-16 w-16">
                          <AvatarImage src={roomInfo.avatar} />
                          <AvatarFallback>{roomInfo.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                      ) : (
                        <Hash className="h-6 w-6 text-primary" />
                      )}
                    </div>
                    <p className="font-semibold">{roomInfo.name}</p>
                    <p className="text-xs text-muted-foreground">{roomInfo.type}</p>
                  </div>

                  <Separator />

                  {/* Members section */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Project Members
                    </p>
                    <div className="space-y-2">
                      {/* Current user */}
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px]">You</AvatarFallback>
                        </Avatar>
                        <span className="text-xs">You</span>
                      </div>
                      {/* Other users in the room */}
                      {privateRooms.find(r => r.id === selectedRoom)?.other_user && (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={privateRooms.find(r => r.id === selectedRoom)?.other_user?.avatar_url || undefined} />
                            <AvatarFallback className="text-[10px]">
                              {(privateRooms.find(r => r.id === selectedRoom)?.other_user?.full_name || 'U').charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs">
                            {privateRooms.find(r => r.id === selectedRoom)?.other_user?.full_name || 'User'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Shared files */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Shared Files
                    </p>
                    {messages.filter(m => m.attachment_url).length === 0 ? (
                      <p className="text-xs text-muted-foreground">No files shared</p>
                    ) : (
                      <div className="space-y-1.5">
                        {messages
                          .filter(m => m.attachment_url)
                          .slice(-5)
                          .map(m => (
                            <a
                              key={m.id}
                              href={m.attachment_url!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors"
                            >
                              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="text-xs truncate">{m.attachment_name || 'File'}</span>
                            </a>
                          ))
                        }
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
