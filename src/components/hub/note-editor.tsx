'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotes, useNoteMutations } from '@/hooks/hub/use-notes';
import { useTranslations } from 'next-intl';
import type { Note } from '@/types/hub';
import { Timestamp } from 'firebase/firestore';

interface NoteEditorProps {
  freelancerId: string;
  workspaceId: string;
}

function formatDate(value: Note['updatedAt']): string {
  if (!value || !(value instanceof Timestamp)) return '';
  return value.toDate().toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function NoteEditor({ freelancerId, workspaceId }: NoteEditorProps) {
  const { data: notes = [], isLoading: loading } = useNotes(freelancerId, workspaceId);
  const { create, update, remove } = useNoteMutations(freelancerId, workspaceId);
  const t = useTranslations('notes');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Local edits for optimistic UI
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<Pick<Note, 'title' | 'content'>>>>({});

  // Auto-select first note when data changes and nothing is selected
  useEffect(() => {
    if (!selectedId && notes.length > 0) {
      setSelectedId(notes[0].id);
    }
  }, [notes, selectedId]);

  const selectedNote = notes.find((n) => n.id === selectedId) ?? null;
  const displayNote = selectedNote
    ? { ...selectedNote, ...localEdits[selectedNote.id] }
    : null;

  async function handleNewNote() {
    const id = await create.mutateAsync({
      title: t('untitledNote'),
      content: '',
    });
    setSelectedId(id);
  }

  async function handleDelete(noteId: string) {
    setDeletingId(noteId);
    try {
      await remove.mutateAsync(noteId);
      if (selectedId === noteId) {
        const remaining = notes.filter((n) => n.id !== noteId);
        setSelectedId(remaining.length > 0 ? remaining[0].id : null);
      }
      setLocalEdits((prev) => {
        const next = { ...prev };
        delete next[noteId];
        return next;
      });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleTitleBlur(noteId: string, title: string) {
    await update.mutateAsync({ noteId, data: { title } });
    setLocalEdits((prev) => {
      const next = { ...prev };
      if (next[noteId]) {
        delete next[noteId].title;
        if (Object.keys(next[noteId]).length === 0) delete next[noteId];
      }
      return next;
    });
  }

  async function handleContentBlur(noteId: string, content: string) {
    await update.mutateAsync({ noteId, data: { content } });
    setLocalEdits((prev) => {
      const next = { ...prev };
      if (next[noteId]) {
        delete next[noteId].content;
        if (Object.keys(next[noteId]).length === 0) delete next[noteId];
      }
      return next;
    });
  }

  function handleLocalTitleChange(noteId: string, title: string) {
    setLocalEdits((prev) => ({
      ...prev,
      [noteId]: { ...prev[noteId], title },
    }));
  }

  function handleLocalContentChange(noteId: string, content: string) {
    setLocalEdits((prev) => ({
      ...prev,
      [noteId]: { ...prev[noteId], content },
    }));
  }

  return (
    <div className="flex h-full min-h-[400px] rounded-lg border overflow-hidden bg-white">
      {/* Left panel: note list */}
      <div className="w-56 shrink-0 border-r flex flex-col">
        <div className="p-3 border-b">
          <Button
            size="sm"
            className="w-full"
            onClick={handleNewNote}
            disabled={create.isPending}
          >
            {create.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5 mr-1.5" />
            )}
            {t('newNote')}
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : notes.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6 px-3">
              {t('noNotesYet')}
            </p>
          ) : (
            <ul className="p-2 space-y-0.5">
              {notes.map((note) => (
                <li key={note.id}>
                  <button
                    onClick={() => setSelectedId(note.id)}
                    className={`w-full text-left flex items-start gap-2 rounded-md px-2 py-2 text-sm transition-colors group ${
                      selectedId === note.id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-gray-100 text-foreground'
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0 opacity-60" />
                    <span className="flex-1 truncate font-medium text-xs leading-snug">
                      {note.title || t('untitledNote')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </div>

      {/* Right panel: note content */}
      <div className="flex-1 flex flex-col min-w-0">
        {displayNote && selectedNote ? (
          <>
            <div className="flex items-center gap-2 px-4 py-3 border-b">
              <Input
                className="font-semibold border-none shadow-none focus-visible:ring-0 px-0 text-base h-auto"
                value={displayNote.title}
                onChange={(e) => handleLocalTitleChange(selectedNote.id, e.target.value)}
                onBlur={(e) => handleTitleBlur(selectedNote.id, e.target.value)}
                placeholder={t('noteTitle')}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => handleDelete(selectedNote.id)}
                disabled={deletingId === selectedNote.id}
              >
                {deletingId === selectedNote.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            <Textarea
              className="flex-1 resize-none rounded-none border-none shadow-none focus-visible:ring-0 px-4 py-3 text-sm font-mono"
              value={displayNote.content}
              onChange={(e) => handleLocalContentChange(selectedNote.id, e.target.value)}
              onBlur={(e) => handleContentBlur(selectedNote.id, e.target.value)}
              placeholder={t('writeNotesPlaceholder')}
            />
            <div className="px-4 py-2 border-t">
              <p className="text-xs text-muted-foreground">
                {formatDate(selectedNote.updatedAt)
                  ? `${t('lastUpdated')} ${formatDate(selectedNote.updatedAt)}`
                  : t('autoSavesOnBlur')}
              </p>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              t('selectOrCreateNote')
            )}
          </div>
        )}
      </div>
    </div>
  );
}
