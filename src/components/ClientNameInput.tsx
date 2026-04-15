import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Building2, Search } from 'lucide-react';

interface ClientNameInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export function ClientNameInput({ value, onChange, placeholder = 'Search or enter client name...', className, required }: ClientNameInputProps) {
  const [existingClients, setExistingClients] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase
        .from('projects')
        .select('client_name')
        .not('client_name', 'is', null)
        .order('client_name');

      if (data) {
        const unique = [...new Set(data.map(d => d.client_name).filter(Boolean))] as string[];
        setExistingClients(unique);
      }
    };
    fetchClients();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = existingClients.filter(c =>
    c.toLowerCase().includes(value.toLowerCase())
  );

  const shouldShowSuggestions = focused && (filtered.length > 0 || value.length === 0) && showSuggestions;

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => {
            setFocused(true);
            setShowSuggestions(true);
          }}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className={cn('pl-9', className)}
          required={required}
        />
      </div>
      {shouldShowSuggestions && filtered.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
          {filtered.map(client => (
            <button
              key={client}
              type="button"
              className={cn(
                'flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors',
                client === value && 'bg-accent'
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(client);
                setShowSuggestions(false);
              }}
            >
              <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span>{client}</span>
            </button>
          ))}
          {value && !existingClients.some(c => c.toLowerCase() === value.toLowerCase()) && (
            <div className="px-3 py-2 text-xs text-muted-foreground border-t">
              Press Enter to use "<span className="font-medium text-foreground">{value}</span>" as a new client
            </div>
          )}
        </div>
      )}
    </div>
  );
}
