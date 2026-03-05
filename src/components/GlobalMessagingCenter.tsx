import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Dialog, DialogContent } from './ui/dialog';
import { Button } from './ui/button';
import { MessageInput } from './MessageInput';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useUserPresence } from '@/hooks/useUserPresence';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  MessageSquare, Users, Trash2, Hash, Plus, Search, X,
  FileText, UserPlus, Building2, ChevronRight, FolderKanban, ChevronDown,
  Reply, CornerDownRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from './ui/input';
import { Separator } from './ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { MessageConfirmDialog } from './MessageConfirmDialog';
import { MessageEditDialog } from './MessageEditDialog';
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

export const GlobalMessagingCenter = ({ open, onOpenChange }: GlobalMessagingCenterProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();

  const urlProjectId = useMemo(() => {
    const match = location.pathname.match(/\/projects\/([^/]+)/);
    return match ? match[1] : null;
  }, [location.pathname]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(urlProjectId);
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
  const [channelsCollapsed, setChannelsCollapsed] = useState(false);
  const [groupsCollapsed, setGroupsCollapsed] = useState(false);
  const [dmsCollapsed, setDmsCollapsed] = useState(false);
  const [unreadByRoom, setUnreadByRoom] = useState<Map<string, number>>(new Map());
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [reactions, setReactions] = useState<Map<string, Array<{ emoji: string; user_id: string; id: string }>>>(new Map());
  const [roomParticipants, setRoomParticipants] = useState<UserProfile[]>([]);

  // Threading
  const [replyTo, setReplyTo] = useState<{ id: string; content: string; userName: string } | null>(null);

  // Edit/Delete dialogs
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<{ id: string; content: string } | null>(null);

  // Auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, loading, sendMessage, editMessage, deleteMessage } = useChatMessages(selectedRoom);
  const { presenceMap } = useUserPresence();

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (urlProjectId && open) setSelectedProjectId(urlProjectId);
  }, [urlProjectId, open]);

  // Fetch projects
  useEffect(() => {
    if (!open || !user) return;
    const fetchProjects = async () => {
      setLoadingProjects(true);
      const { data: memberProjects } = await supabase
        .from('project_members').select('project_id').eq('user_id', user.id);
      const { data: ownedProjects } = await supabase
        .from('projects').select('id').eq('owner_id', user.id);
      const projectIds = new Set<string>();
      memberProjects?.forEach(m => projectIds.add(m.project_id));
      ownedProjects?.forEach(p => projectIds.add(p.id));
      if (projectIds.size === 0) {
        setProjects([]);
      } else {
        const { data } = await supabase.from('projects').select('id, name, logo_url')
          .in('id', Array.from(projectIds)).order('name');
        setProjects(data || []);
      }
      if (!selectedProjectId && projectIds.size > 0) setSelectedProjectId(Array.from(projectIds)[0]);
      setLoadingProjects(false);
    };
    fetchProjects();
  }, [open, user]);

  // Fetch project-scoped users
  useEffect(() => {
    if (!open || !user || !selectedProjectId) return;
    const fetchProjectUsers = async () => {
      const { data: members } = await supabase.from('project_members').select('user_id').eq('project_id', selectedProjectId);
      const { data: project } = await supabase.from('projects').select('owner_id').eq('id', selectedProjectId).single();
      const userIds = new Set<string>();
      members?.forEach(m => userIds.add(m.user_id));
      if (project?.owner_id) userIds.add(project.owner_id);
      userIds.delete(user.id);
      if (userIds.size === 0) { setProjectUsers([]); return; }
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url, email')
        .in('id', Array.from(userIds)).order('full_name');
      setProjectUsers(profiles || []);
    };
    fetchProjectUsers();
  }, [open, user, selectedProjectId]);

  // Fetch departments
  useEffect(() => {
    if (!open || !selectedProjectId) return;
    const fetch = async () => {
      const { data } = await supabase.from('departments').select('id, name')
        .eq('project_id', selectedProjectId).order('name');
      setDepartments(data || []);
    };
    fetch();
  }, [open, selectedProjectId]);

  // Fetch public room
  useEffect(() => {
    if (!selectedProjectId || !open || !user) { setPublicRoom(null); return; }
    const fetch = async () => {
      const { data: existing } = await supabase.from('chat_rooms').select('*')
        .eq('project_id', selectedProjectId).eq('room_type', 'public').maybeSingle();
      let room = existing;
      if (!room) {
        const { data: newRoom } = await supabase.from('chat_rooms').insert({
          project_id: selectedProjectId, room_type: 'public', name: 'General', created_by: user.id,
        }).select().single();
        room = newRoom;
      }
      if (room) {
        setPublicRoom(room);
        await supabase.from('chat_participants').upsert(
          { room_id: room.id, user_id: user.id }, { onConflict: 'room_id,user_id' }
        );
        if (!selectedRoom) setSelectedRoom(room.id);
      }
    };
    fetch();
  }, [selectedProjectId, open, user]);

  // Fetch department channels
  useEffect(() => {
    if (!selectedProjectId || !open || !user) return;
    const fetch = async () => {
      const { data } = await supabase.from('chat_rooms').select('*')
        .eq('project_id', selectedProjectId).eq('room_type', 'department' as any);
      setDepartmentRooms(data || []);
    };
    fetch();
  }, [selectedProjectId, open, user]);

  // Fetch private & group rooms
  useEffect(() => {
    if (!selectedProjectId || !open || !user) { setPrivateRooms([]); setGroupRooms([]); return; }
    const fetchRooms = async () => {
      const { data: participations } = await supabase.from('chat_participants').select('room_id').eq('user_id', user.id);
      if (!participations?.length) { setPrivateRooms([]); setGroupRooms([]); return; }
      const roomIds = participations.map(p => p.room_id);
      const { data: privRooms } = await supabase.from('chat_rooms').select('*')
        .in('id', roomIds).eq('room_type', 'private').eq('project_id', selectedProjectId);
      const privateWithUsers = await Promise.all(
        (privRooms || []).map(async (room) => {
          const { data: other } = await supabase.from('chat_participants').select('user_id')
            .eq('room_id', room.id).neq('user_id', user.id).single();
          let roomData: ChatRoom = { ...room };
          if (other) {
            const { data: profile } = await supabase.from('profiles')
              .select('id, full_name, avatar_url, email').eq('id', other.user_id).single();
            roomData.other_user = profile || undefined;
          }
          return roomData;
        })
      );
      privateWithUsers.sort((a, b) => {
        const tA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const tB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return tB - tA;
      });
      setPrivateRooms(privateWithUsers);
      const { data: grpRooms } = await supabase.from('chat_rooms').select('*')
        .in('id', roomIds).eq('room_type', 'group' as any).eq('project_id', selectedProjectId);
      setGroupRooms(grpRooms || []);
    };
    fetchRooms();
    const ch = supabase.channel(`global-msg-${selectedProjectId}-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => fetchRooms())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedProjectId, open, user]);

  // Unread counts
  useEffect(() => {
    if (!selectedProjectId || !open || !user) return;
    const fetch = async () => {
      const { data: participations } = await supabase.from('chat_participants')
        .select('room_id, last_read_at').eq('user_id', user.id);
      if (!participations) return;
      const roomIds = participations.map(p => p.room_id);
      const { data: rooms } = await supabase.from('chat_rooms').select('id')
        .eq('project_id', selectedProjectId).in('id', roomIds);
      if (!rooms) return;
      const projectRoomIds = rooms.map(r => r.id);
      const unreadMap = new Map<string, number>();
      for (const p of participations) {
        if (!projectRoomIds.includes(p.room_id)) continue;
        const { count } = await supabase.from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', p.room_id).neq('user_id', user.id)
          .gt('created_at', p.last_read_at || '1970-01-01').is('deleted_at', null);
        unreadMap.set(p.room_id, count || 0);
      }
      setUnreadByRoom(unreadMap);
    };
    fetch();
  }, [selectedProjectId, open, user]);

  // Reactions
  useEffect(() => {
    if (!selectedRoom || !messages.length) return;
    const fetch = async () => {
      const msgIds = messages.map(m => m.id);
      const { data } = await supabase.from('message_reactions').select('*').in('message_id', msgIds);
      const map = new Map<string, Array<{ emoji: string; user_id: string; id: string }>>();
      data?.forEach(r => {
        const arr = map.get(r.message_id) || [];
        arr.push({ emoji: r.emoji, user_id: r.user_id, id: r.id });
        map.set(r.message_id, arr);
      });
      setReactions(map);
    };
    fetch();
  }, [selectedRoom, messages]);

  // Fetch room participants for right panel
  useEffect(() => {
    if (!selectedRoom || !showRightPanel) return;
    const fetchParticipants = async () => {
      const { data: parts } = await supabase.from('chat_participants')
        .select('user_id').eq('room_id', selectedRoom);
      if (!parts || parts.length === 0) { setRoomParticipants([]); return; }
      const ids = parts.map(p => p.user_id);
      const { data: profiles } = await supabase.from('profiles')
        .select('id, full_name, avatar_url, email').in('id', ids);
      setRoomParticipants(profiles || []);
    };
    fetchParticipants();
  }, [selectedRoom, showRightPanel]);

  const markRoomAsRead = useCallback(async (roomId: string) => {
    if (!user) return;
    await supabase.from('chat_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('room_id', roomId).eq('user_id', user.id);
    setUnreadByRoom(prev => { const m = new Map(prev); m.set(roomId, 0); return m; });
  }, [user]);

  useEffect(() => { if (selectedRoom) markRoomAsRead(selectedRoom); }, [selectedRoom, markRoomAsRead]);

  const createPrivateChat = async (otherUserId: string) => {
    if (!user || !selectedProjectId) return;
    const { data: myParts } = await supabase.from('chat_participants').select('room_id').eq('user_id', user.id);
    if (myParts?.length) {
      const roomIds = myParts.map(p => p.room_id);
      const { data: otherParts } = await supabase.from('chat_participants').select('room_id')
        .eq('user_id', otherUserId).in('room_id', roomIds);
      if (otherParts?.length) {
        const shared = otherParts.map(p => p.room_id);
        const { data: existing } = await supabase.from('chat_rooms').select('*')
          .in('id', shared).eq('room_type', 'private').eq('project_id', selectedProjectId).limit(1).maybeSingle();
        if (existing) { setSelectedRoom(existing.id); setShowNewChat(false); return; }
      }
    }
    const { data: newRoom, error } = await supabase.from('chat_rooms')
      .insert({ project_id: selectedProjectId, room_type: 'private', created_by: user.id }).select().single();
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    await supabase.from('chat_participants').insert([
      { room_id: newRoom.id, user_id: user.id },
      { room_id: newRoom.id, user_id: otherUserId },
    ]);
    const { data: profile } = await supabase.from('profiles')
      .select('id, full_name, avatar_url, email').eq('id', otherUserId).single();
    setPrivateRooms(prev => [{ ...newRoom, other_user: profile || undefined }, ...prev]);
    setSelectedRoom(newRoom.id);
    setShowNewChat(false);
  };

  const createGroupChat = async () => {
    if (!user || !selectedProjectId || selectedGroupUsers.length < 2 || !groupName.trim()) return;
    const { data: newRoom, error } = await supabase.from('chat_rooms')
      .insert({ project_id: selectedProjectId, room_type: 'group' as any, name: groupName.trim(), created_by: user.id } as any)
      .select().single();
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    await supabase.from('chat_participants').insert(
      [user.id, ...selectedGroupUsers].map(uid => ({ room_id: newRoom.id, user_id: uid }))
    );
    setGroupRooms(prev => [newRoom, ...prev]);
    setSelectedRoom(newRoom.id);
    setShowNewGroup(false);
    setSelectedGroupUsers([]);
    setGroupName('');
  };

  const createDepartmentChannel = async (dept: Department) => {
    if (!user || !selectedProjectId) return;
    const existing = departmentRooms.find(r => r.department_id === dept.id);
    if (existing) { setSelectedRoom(existing.id); return; }
    const { data: newRoom, error } = await supabase.from('chat_rooms')
      .insert({ project_id: selectedProjectId, room_type: 'department' as any, name: dept.name, department_id: dept.id, created_by: user.id } as any)
      .select().single();
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    await supabase.from('chat_participants').upsert(
      { room_id: newRoom.id, user_id: user.id }, { onConflict: 'room_id,user_id' }
    );
    setDepartmentRooms(prev => [...prev, newRoom]);
    setSelectedRoom(newRoom.id);
  };

  const deleteConversation = async (roomId: string) => {
    const { error } = await supabase.from('chat_rooms').delete().eq('id', roomId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setPrivateRooms(prev => prev.filter(r => r.id !== roomId));
    setGroupRooms(prev => prev.filter(r => r.id !== roomId));
    if (selectedRoom === roomId) setSelectedRoom(null);
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const msgReactions = reactions.get(messageId) || [];
    const existing = msgReactions.find(r => r.emoji === emoji && r.user_id === user.id);
    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id);
      setReactions(prev => {
        const m = new Map(prev);
        m.set(messageId, (m.get(messageId) || []).filter(r => r.id !== existing.id));
        return m;
      });
    } else {
      const { data } = await supabase.from('message_reactions')
        .insert({ message_id: messageId, user_id: user.id, emoji }).select().single();
      if (data) {
        setReactions(prev => {
          const m = new Map(prev);
          m.set(messageId, [...(m.get(messageId) || []), { emoji: data.emoji, user_id: data.user_id, id: data.id }]);
          return m;
        });
      }
    }
  };

  const handleEditClick = (messageId: string, content: string) => {
    setSelectedMessage({ id: messageId, content });
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (messageId: string) => {
    setSelectedMessage({ id: messageId, content: '' });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedMessage) deleteMessage(selectedMessage.id);
    setDeleteDialogOpen(false);
    setSelectedMessage(null);
  };

  const handleSaveEdit = (newContent: string) => {
    if (selectedMessage) editMessage(selectedMessage.id, newContent);
    setEditDialogOpen(false);
    setSelectedMessage(null);
  };

  const handleSendWithReply = (content: string, attachment?: { url: string; name: string; type: string; size: number }) => {
    sendMessage(content, attachment);
    setReplyTo(null);
  };

  const getUserStatus = (userId: string) => presenceMap.get(userId)?.status || 'offline';
  const getStatusColor = (s: string) => {
    switch (s) { case 'online': return 'bg-green-500'; case 'away': return 'bg-amber-500'; case 'busy': return 'bg-red-500'; default: return 'bg-muted-foreground/30'; }
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

  const filteredPrivateRooms = privateRooms.filter(r => {
    if (!searchQuery) return true;
    return (r.other_user?.full_name || r.other_user?.email || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredNewChatUsers = projectUsers.filter(u => {
    if (privateRooms.some(r => r.other_user?.id === u.id)) return false;
    if (!newChatSearch) return true;
    return u.full_name?.toLowerCase().includes(newChatSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(newChatSearch.toLowerCase());
  });

  const getParentMessage = (parentId: string | null) => {
    if (!parentId) return null;
    return messages.find(m => m.id === parentId);
  };

  const roomInfo = getSelectedRoomInfo();
  const quickEmojis = ['👍', '❤️', '🔥', '✅', '🎉', '😂'];
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden [&>button[class*='absolute']]:hidden">
          <div className="flex flex-1 overflow-hidden">
            {/* LEFT PANEL */}
            <div className="w-72 border-r bg-muted/30 flex flex-col flex-shrink-0">
              <div className="p-3 border-b space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => onOpenChange(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                  <span className="text-base font-bold">Messages</span>
                </div>
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full gap-2 justify-between h-9 text-sm" disabled={loadingProjects}>
                    {selectedProject ? (
                      <div className="flex items-center gap-2 min-w-0">
                        {selectedProject.logo_url ? <img src={selectedProject.logo_url} alt="" className="h-4 w-4 object-contain rounded flex-shrink-0" /> : <FolderKanban className="h-3.5 w-3.5 flex-shrink-0" />}
                        <span className="truncate">{selectedProject.name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Select project</span>
                    )}
                    <ChevronDown className="h-3.5 w-3.5 opacity-50 flex-shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[240px] max-h-[300px] overflow-y-auto">
                  {projects.map(p => (
                    <DropdownMenuItem key={p.id} onClick={() => { setSelectedProjectId(p.id); setSelectedRoom(null); }} className="gap-2">
                      {p.logo_url ? <img src={p.logo_url} alt="" className="h-4 w-4 rounded" /> : <FolderKanban className="h-3.5 w-3.5" />}
                      <span className="truncate">{p.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Messages</span>
                <div className="flex items-center gap-1">
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px] px-2" onClick={() => { setShowNewChat(true); setShowNewGroup(false); }}>
                          <UserPlus className="h-3 w-3" />
                          Chat
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Start a new direct message</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px] px-2" onClick={() => { setShowNewGroup(true); setShowNewChat(false); }}>
                          <Plus className="h-3 w-3" />
                          Group
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Create a group chat</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 pl-8 text-sm bg-background" />
              </div>
            </div>

            {!selectedProjectId ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground p-4">
                <div className="text-center space-y-2">
                  <FolderKanban className="h-10 w-10 mx-auto opacity-30" />
                  <p className="text-xs">Select a project</p>
                </div>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="p-2">
                  {/* Channels */}
                  <div className="mb-1">
                    <button className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-muted/50 rounded-md transition-colors" onClick={() => setChannelsCollapsed(!channelsCollapsed)}>
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Channels</span>
                      <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${channelsCollapsed ? '-rotate-90' : ''}`} />
                    </button>
                    {!channelsCollapsed && (
                      <>
                        {publicRoom && (
                          <button className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${selectedRoom === publicRoom.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`} onClick={() => setSelectedRoom(publicRoom.id)}>
                            <Hash className="h-4 w-4 opacity-60" />
                            <span className="truncate flex-1 text-left">General</span>
                            {(unreadByRoom.get(publicRoom.id) || 0) > 0 && <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">{unreadByRoom.get(publicRoom.id)}</Badge>}
                          </button>
                        )}
                        {departmentRooms.map(room => (
                          <button key={room.id} className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${selectedRoom === room.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`} onClick={() => setSelectedRoom(room.id)}>
                            <Building2 className="h-4 w-4 opacity-60" />
                            <span className="truncate flex-1 text-left">{room.name}</span>
                            {(unreadByRoom.get(room.id) || 0) > 0 && <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">{unreadByRoom.get(room.id)}</Badge>}
                          </button>
                        ))}
                        {departments.filter(d => !departmentRooms.find(r => r.department_id === d.id)).map(dept => (
                          <button key={dept.id} className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm hover:bg-muted text-muted-foreground" onClick={() => createDepartmentChannel(dept)}>
                            <Building2 className="h-4 w-4 opacity-40" />
                            <span className="truncate flex-1 text-left">{dept.name}</span>
                          </button>
                        ))}
                      </>
                    )}
                  </div>

                  {groupRooms.length > 0 && (
                    <div className="mb-1">
                      <button className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-muted/50 rounded-md transition-colors" onClick={() => setGroupsCollapsed(!groupsCollapsed)}>
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Groups</span>
                        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${groupsCollapsed ? '-rotate-90' : ''}`} />
                      </button>
                      {!groupsCollapsed && groupRooms.map(room => (
                        <button key={room.id} className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${selectedRoom === room.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`} onClick={() => setSelectedRoom(room.id)}>
                          <Users className="h-4 w-4 opacity-60" />
                          <span className="truncate flex-1 text-left">{room.name || 'Group'}</span>
                          {(unreadByRoom.get(room.id) || 0) > 0 && <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">{unreadByRoom.get(room.id)}</Badge>}
                        </button>
                      ))}
                    </div>
                  )}

                  <Separator className="my-2" />

                  <div className="mb-1">
                    <button className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-muted/50 rounded-md transition-colors" onClick={() => setDmsCollapsed(!dmsCollapsed)}>
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Direct Messages</span>
                      <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${dmsCollapsed ? '-rotate-90' : ''}`} />
                    </button>
                    {!dmsCollapsed && (<>
                    {filteredPrivateRooms.map(room => {
                      const unread = unreadByRoom.get(room.id) || 0;
                      const status = room.other_user?.id ? getUserStatus(room.other_user.id) : 'offline';
                      return (
                        <div key={room.id} className="relative group">
                          <button className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${selectedRoom === room.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`} onClick={() => setSelectedRoom(room.id)}>
                            <div className="relative flex-shrink-0">
                              <Avatar className="h-7 w-7"><AvatarImage src={room.other_user?.avatar_url || undefined} /><AvatarFallback className="text-[10px]">{(room.other_user?.full_name || 'U').charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                              <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${getStatusColor(status)}`} />
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <span className={`truncate text-sm block ${unread > 0 ? 'font-semibold' : ''}`}>{room.other_user?.full_name || room.other_user?.email || 'User'}</span>
                              {room.last_message_preview && <p className="text-xs text-muted-foreground truncate">{room.last_message_preview}</p>}
                            </div>
                            {unread > 0 && <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">{unread}</Badge>}
                          </button>
                          <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); deleteConversation(room.id); }}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                    {filteredPrivateRooms.length === 0 && !searchQuery && (
                      <p className="text-xs text-muted-foreground px-2.5 py-2">No conversations yet</p>
                    )}
                    </>)}
                  </div>
                </div>
              </ScrollArea>
            )}
          </div>

          {/* CENTER PANEL */}
          <div className="flex-1 flex flex-col min-w-0">
            {showNewChat ? (
              <div className="flex-1 flex flex-col">
                <div className="border-b px-4 py-3 flex items-center justify-between">
                  <h3 className="font-semibold">New Message</h3>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowNewChat(false)}><X className="h-4 w-4" /></Button>
                </div>
                <div className="p-4">
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search project members..." value={newChatSearch} onChange={(e) => setNewChatSearch(e.target.value)} className="pl-10" autoFocus />
                  </div>
                  <ScrollArea className="h-[calc(100vh-300px)]">
                    <div className="space-y-1">
                      {filteredNewChatUsers.map(u => (
                        <button key={u.id} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors" onClick={() => createPrivateChat(u.id)}>
                          <div className="relative">
                            <Avatar className="h-10 w-10"><AvatarImage src={u.avatar_url || undefined} /><AvatarFallback>{u.full_name?.charAt(0) || u.email.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                            <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${getStatusColor(getUserStatus(u.id))}`} />
                          </div>
                          <div className="text-left">
                            <p className="font-medium text-sm">{u.full_name || u.email}</p>
                            {u.full_name && <p className="text-xs text-muted-foreground">{u.email}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            ) : showNewGroup ? (
              <div className="flex-1 flex flex-col">
                <div className="border-b px-4 py-3 flex items-center justify-between">
                  <h3 className="font-semibold">New Group Chat</h3>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setShowNewGroup(false); setSelectedGroupUsers([]); setGroupName(''); }}><X className="h-4 w-4" /></Button>
                </div>
                <div className="p-4 space-y-4">
                  <Input placeholder="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} autoFocus />
                  {selectedGroupUsers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedGroupUsers.map(uid => {
                        const u = projectUsers.find(p => p.id === uid);
                        return <Badge key={uid} variant="secondary" className="gap-1 pl-2">{u?.full_name || u?.email || 'User'}<button onClick={() => setSelectedGroupUsers(prev => prev.filter(id => id !== uid))}><X className="h-3 w-3" /></button></Badge>;
                      })}
                    </div>
                  )}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Add members..." value={newChatSearch} onChange={(e) => setNewChatSearch(e.target.value)} className="pl-10" />
                  </div>
                  <ScrollArea className="h-[calc(100vh-460px)]">
                    <div className="space-y-1">
                      {projectUsers.filter(u => !selectedGroupUsers.includes(u.id) && (!newChatSearch || u.full_name?.toLowerCase().includes(newChatSearch.toLowerCase()) || u.email.toLowerCase().includes(newChatSearch.toLowerCase()))).map(u => (
                        <button key={u.id} className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted" onClick={() => setSelectedGroupUsers(prev => [...prev, u.id])}>
                          <Avatar className="h-8 w-8"><AvatarImage src={u.avatar_url || undefined} /><AvatarFallback className="text-xs">{u.full_name?.charAt(0) || u.email.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                          <span className="text-sm">{u.full_name || u.email}</span>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                  <Button className="w-full" onClick={createGroupChat} disabled={selectedGroupUsers.length < 2 || !groupName.trim()}>
                    Create Group ({selectedGroupUsers.length} members)
                  </Button>
                </div>
              </div>
            ) : selectedRoom ? (
              <>
                {/* Chat Header */}
                <div className="border-b px-4 py-2.5 bg-card flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {roomInfo.avatar ? (
                      <Avatar className="h-9 w-9 flex-shrink-0"><AvatarImage src={roomInfo.avatar} /><AvatarFallback className="text-sm">{roomInfo.name.charAt(0)}</AvatarFallback></Avatar>
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {publicRoom?.id === selectedRoom ? <Hash className="h-4 w-4 text-primary" /> :
                          departmentRooms.find(r => r.id === selectedRoom) ? <Building2 className="h-4 w-4 text-primary" /> :
                          groupRooms.find(r => r.id === selectedRoom) ? <Users className="h-4 w-4 text-primary" /> :
                          <MessageSquare className="h-4 w-4 text-primary" />}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate">{roomInfo.name}</h3>
                      <p className="text-xs text-muted-foreground">{roomInfo.type}</p>
                    </div>
                  </div>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs px-2.5 flex-shrink-0" onClick={() => setShowRightPanel(!showRightPanel)}>
                          <Users className="h-3.5 w-3.5" />
                          Details
                          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showRightPanel ? 'rotate-180' : ''}`} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{showRightPanel ? 'Hide details' : 'Show details'}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {loading ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground"><p className="text-sm">Loading...</p></div>
                  ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center space-y-2"><MessageSquare className="h-10 w-10 mx-auto opacity-20" /><p className="text-sm">No messages yet</p></div>
                    </div>
                  ) : (
                    messages.map((message) => {
                      const isOwn = message.user_id === user?.id;
                      const userName = message.user?.full_name || message.user_email || 'Unknown';
                      const msgReactions = reactions.get(message.id) || [];
                      const parentMsg = getParentMessage(message.parent_message_id);
                      const groupedReactions: { emoji: string; count: number; hasOwn: boolean }[] = [];
                      msgReactions.forEach(r => {
                        const ex = groupedReactions.find(g => g.emoji === r.emoji);
                        if (ex) { ex.count++; if (r.user_id === user?.id) ex.hasOwn = true; }
                        else groupedReactions.push({ emoji: r.emoji, count: 1, hasOwn: r.user_id === user?.id });
                      });

                      return (
                        <div key={message.id} className={`flex gap-3 group ${isOwn ? 'flex-row-reverse' : ''}`}>
                          <Avatar className="h-8 w-8 flex-shrink-0 mt-1"><AvatarImage src={message.user?.avatar_url || undefined} /><AvatarFallback className="text-[10px]">{userName.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                          <div className={`max-w-[65%] ${isOwn ? 'text-right' : ''}`}>
                            <div className={`flex items-center gap-2 mb-0.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
                              <span className="text-xs font-medium">{userName}</span>
                              <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}</span>
                            </div>

                            {/* Reply context */}
                            {parentMsg && (
                              <div className={`flex items-center gap-1.5 mb-1 text-xs text-muted-foreground ${isOwn ? 'justify-end' : ''}`}>
                                <CornerDownRight className="h-3 w-3" />
                                <span className="truncate max-w-[200px] italic">
                                  Replying to: {parentMsg.content.slice(0, 50)}{parentMsg.content.length > 50 ? '...' : ''}
                                </span>
                              </div>
                            )}

                            <div className={`inline-block rounded-2xl px-3.5 py-2 text-sm ${isOwn ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md'}`}>
                              <p className="whitespace-pre-wrap break-words">{message.content}</p>
                              {message.attachment_url && <a href={message.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs mt-1.5 hover:underline opacity-80"><FileText className="h-3 w-3" />{message.attachment_name}</a>}
                              {message.edited_at && <p className="text-[10px] opacity-60 mt-0.5">(edited)</p>}
                            </div>
                            {groupedReactions.length > 0 && (
                              <div className={`flex gap-1 mt-1 flex-wrap ${isOwn ? 'justify-end' : ''}`}>
                                {groupedReactions.map(gr => (
                                  <button key={gr.emoji} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${gr.hasOwn ? 'bg-primary/10 border-primary/30' : 'bg-muted border-transparent hover:border-border'}`} onClick={() => toggleReaction(message.id, gr.emoji)}>
                                    {gr.emoji} {gr.count > 1 && <span className="text-[10px]">{gr.count}</span>}
                                  </button>
                                ))}
                              </div>
                            )}
                            <div className={`flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity ${isOwn ? 'justify-end' : ''}`}>
                              <div className="inline-flex items-center bg-card border border-border rounded-lg shadow-sm p-0.5 gap-0.5">
                                {quickEmojis.slice(0, 4).map(emoji => (
                                  <button key={emoji} className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-sm transition-colors" onClick={() => toggleReaction(message.id, emoji)} title={`React ${emoji}`}>{emoji}</button>
                                ))}
                                <div className="w-px h-4 bg-border mx-0.5" />
                                <button className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center transition-colors" onClick={() => setReplyTo({ id: message.id, content: message.content, userName })} title="Reply">
                                  <Reply className="h-3.5 w-3.5" />
                                </button>
                                {isOwn && (
                                  <>
                                    <button className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center transition-colors" onClick={() => handleEditClick(message.id, message.content)} title="Edit">
                                      <span className="text-xs">✏️</span>
                                    </button>
                                    <button className="h-7 w-7 rounded-md hover:bg-destructive/10 flex items-center justify-center transition-colors" onClick={() => handleDeleteClick(message.id)} title="Delete">
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply banner */}
                {replyTo && (
                  <div className="border-t border-border px-4 py-2 bg-muted/50 flex items-center gap-2">
                    <CornerDownRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">Replying to {replyTo.userName}</p>
                      <p className="text-xs text-muted-foreground truncate">{replyTo.content}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => setReplyTo(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                <MessageInput onSend={handleSendWithReply} />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center space-y-3"><MessageSquare className="h-12 w-12 mx-auto opacity-20" /><p className="text-sm">Select a conversation</p></div>
              </div>
            )}
          </div>

          {/* RIGHT PANEL */}
          {showRightPanel && selectedRoom && (
            <div className="w-64 border-l bg-muted/20 flex flex-col flex-shrink-0">
              <div className="p-4 border-b"><h3 className="font-semibold text-sm">Details</h3></div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  <div className="text-center">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                      {roomInfo.avatar ? <Avatar className="h-16 w-16"><AvatarImage src={roomInfo.avatar} /><AvatarFallback>{roomInfo.name.charAt(0)}</AvatarFallback></Avatar> : <Hash className="h-6 w-6 text-primary" />}
                    </div>
                    <p className="font-semibold">{roomInfo.name}</p>
                    <p className="text-xs text-muted-foreground">{roomInfo.type}</p>
                  </div>

                  <Separator />

                  {/* Members */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Members ({roomParticipants.length})
                    </p>
                    <div className="space-y-2">
                      {roomParticipants.map(p => {
                        const status = getUserStatus(p.id);
                        return (
                          <div key={p.id} className="flex items-center gap-2">
                            <div className="relative">
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={p.avatar_url || undefined} />
                                <AvatarFallback className="text-[10px]">{(p.full_name || p.email || 'U').charAt(0).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background ${getStatusColor(status)}`} />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs truncate block">{p.id === user?.id ? 'You' : (p.full_name || p.email)}</span>
                              <span className="text-[10px] text-muted-foreground capitalize">{status}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  {/* Department info */}
                  {(() => {
                    const deptRoom = departmentRooms.find(r => r.id === selectedRoom);
                    if (!deptRoom?.department_id) return null;
                    const dept = departments.find(d => d.id === deptRoom.department_id);
                    if (!dept) return null;
                    return (
                      <>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Department</p>
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{dept.name}</span>
                          </div>
                        </div>
                        <Separator />
                      </>
                    );
                  })()}

                  {/* Shared files */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Shared Files</p>
                    {messages.filter(m => m.attachment_url).length === 0 ? (
                      <p className="text-xs text-muted-foreground">No files shared</p>
                    ) : (
                      <div className="space-y-1.5">
                        {messages.filter(m => m.attachment_url).slice(-5).map(m => (
                          <a key={m.id} href={m.attachment_url!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted">
                            <FileText className="h-4 w-4 text-muted-foreground" /><span className="text-xs truncate">{m.attachment_name || 'File'}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Edit Dialog */}
      <MessageEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        currentContent={selectedMessage?.content || ''}
        onSave={handleSaveEdit}
      />

      {/* Delete Confirmation Dialog */}
      <MessageConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Message"
        description="Are you sure you want to delete this message? This action cannot be undone."
        onConfirm={handleConfirmDelete}
        confirmText="Delete"
        variant="destructive"
      />
    </Dialog>
  );
};
