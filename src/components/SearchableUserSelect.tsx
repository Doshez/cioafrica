import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Search } from 'lucide-react';

interface User {
  id: string;
  full_name: string | null;
  email: string;
}

interface SearchableUserSelectProps {
  users: User[];
  selectedUserIds: string[];
  onSelectionChange: (userIds: string[]) => void;
  placeholder?: string;
}

export function SearchableUserSelect({
  users,
  selectedUserIds,
  onSelectionChange,
  placeholder = "Search users..."
}: SearchableUserSelectProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(user =>
      (user.full_name?.toLowerCase().includes(query)) ||
      user.email.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  const handleUserToggle = (userId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedUserIds, userId]);
    } else {
      onSelectionChange(selectedUserIds.filter(id => id !== userId));
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="border rounded-md p-2 space-y-1 max-h-48 overflow-y-auto bg-background">
        {filteredUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">
            {searchQuery ? 'No users found' : 'No users available'}
          </p>
        ) : (
          filteredUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded"
              onClick={() => handleUserToggle(user.id, !selectedUserIds.includes(user.id))}
            >
              <Checkbox
                checked={selectedUserIds.includes(user.id)}
                onCheckedChange={(checked) => handleUserToggle(user.id, checked === true)}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.full_name || user.email}</p>
                {user.full_name && (
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      {selectedUserIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selectedUserIds.length} user(s) selected
        </p>
      )}
    </div>
  );
}
