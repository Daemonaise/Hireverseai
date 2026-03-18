'use client';

import { useState } from 'react';
import { Trash2, Plus, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBookmarks, useBookmarkMutations } from '@/hooks/hub/use-bookmarks';
import { useTranslations } from 'next-intl';

interface BookmarkListProps {
  freelancerId: string;
  workspaceId: string;
}

const EMPTY_FORM = { title: '', url: '', description: '' };

export function BookmarkList({ freelancerId, workspaceId }: BookmarkListProps) {
  const { data: bookmarks = [], isLoading: loading } = useBookmarks(freelancerId, workspaceId);
  const { add, remove } = useBookmarkMutations(freelancerId, workspaceId);
  const t = useTranslations('bookmarks');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd() {
    if (!form.title.trim() || !form.url.trim()) return;
    await add.mutateAsync({
      title: form.title.trim(),
      url: form.url.trim(),
      description: form.description.trim(),
    });
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  async function handleDelete(bookmarkId: string) {
    setDeletingId(bookmarkId);
    try {
      await remove.mutateAsync(bookmarkId);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
          {t('bookmarks')}
        </h3>
        <Button
          size="sm"
          variant={showForm ? 'secondary' : 'default'}
          onClick={() => {
            setShowForm((v) => !v);
            setForm(EMPTY_FORM);
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {showForm ? t('cancel') : t('addBookmark')}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">{t('newBookmark')}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            <Input
              placeholder={t('title')}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <Input
              placeholder={t('urlPlaceholder')}
              type="url"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            />
            <Input
              placeholder={t('descriptionOptional')}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={add.isPending || !form.title.trim() || !form.url.trim()}
              >
                {add.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                {t('save')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowForm(false);
                  setForm(EMPTY_FORM);
                }}
              >
                {t('cancel')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : bookmarks.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {t('noBookmarksYet')}
        </p>
      ) : (
        <ul className="space-y-2">
          {bookmarks.map((bookmark) => (
            <li key={bookmark.id}>
              <Card>
                <CardContent className="flex items-start gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <a
                      href={bookmark.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-sm text-primary hover:underline"
                    >
                      {bookmark.title}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                    {bookmark.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {bookmark.description}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleDelete(bookmark.id)}
                    disabled={deletingId === bookmark.id}
                  >
                    {deletingId === bookmark.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
