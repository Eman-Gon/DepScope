import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SearchInputProps {
  onAnalyze: (query: string) => void;
  isLoading: boolean;
}

const SearchInput = ({ onAnalyze, isLoading }: SearchInputProps) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onAnalyze(query);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-4xl mx-auto">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Paste a GitHub URL or npm package name..."
            className="pl-12 h-14 text-lg bg-card border-border focus:border-primary focus:ring-primary/20 transition-all"
          />
        </div>
        <Button 
          type="submit" 
          size="lg" 
          className="h-14 px-8 text-lg font-semibold glow-blue hover:glow-blue transition-all"
          disabled={isLoading || !query.trim()}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            'Analyze'
          )}
        </Button>
      </div>
    </form>
  );
};

export default SearchInput;
