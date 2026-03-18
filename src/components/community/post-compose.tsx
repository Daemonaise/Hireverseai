'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/auth-context';
import { useCreatePost } from '@/hooks/use-community';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { PostCategory } from '@/types/community';

const CATEGORIES: { value: PostCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'showcase', label: 'Showcase' },
  { value: 'help', label: 'Help' },
  { value: 'hiring', label: 'Hiring' },
  { value: 'feedback', label: 'Feedback' },
];

interface PostComposeProps {
  onClose: () => void;
}

export function PostCompose({ onClose }: PostComposeProps) {
  const { user } = useAuth();
  const createPost = useCreatePost();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<PostCategory>('general');
  const [tags, setTags] = useState('');

  const handleSubmit = async () => {
    if (!user || !title.trim() || !body.trim()) return;
    try {
      await createPost.mutateAsync({
        authorId: user.uid,
        authorName: user.displayName ?? 'Anonymous',
        authorLevel: 1,
        authorLevelTitle: 'Newcomer',
        category,
        title: title.trim(),
        body: body.trim(),
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      toast({ title: 'Post created' });
      onClose();
    } catch {
      toast({ title: 'Error', description: 'Failed to create post.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-6">
      <h3 className="text-lg font-semibold">New Post</h3>
      <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              category === c.value ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <Textarea placeholder="Write your post..." value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[120px]" />
      <Input placeholder="Tags (comma-separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit} disabled={!title.trim() || !body.trim() || createPost.isPending}>
          {createPost.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          Post
        </Button>
      </div>
    </div>
  );
}
