'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Trash2, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { addNote, listNotes, updateNote, deleteNote } from '@/services/hub/notes';
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
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const selectedNote = notes.find((n) => n.id === selectedId) ?? null;

  const refreshNotes = useCallback(async () => {
    const data = await listNotes(freelancerId, workspaceId);
    setNotes(data);
    return data;
  }, [freelancerId, workspaceId]);

  useEffect(() => {
    refreshNotes().then((data) => {
      setLoading(false);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }
    });
  }, [refreshNotes, selectedId]);

  async function handleNewNote() {
    setCreating(true);
    try {
      const id = await addNote(freelancerId, workspaceId, {
        title: 'Untitled Note',
        content: '',
      });
      const data = await refreshNotes();
      setSelectedId(id);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(noteId: string) {
    setDeletingId(noteId);
    try {
      await deleteNote(freelancerId, workspaceId, noteId);
      const data = await refreshNotes();
      if (selectedId === noteId) {
        setSelectedId(data.length > 0 ? data[0].id : null);
      }
    } finally {
      setDeletingId(null);
    }
  }

  async function handleTitleBlur(noteId: string, title: string) {
    await updateNote(freelancerId, workspaceId, noteId, { title });
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, title } : n))
    );
  }

  async function handleContentBlur(noteId: string, content: string) {
    await updateNote(freelancerId, workspaceId, noteId, { content });
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, content } : n))
    );
  }

  function handleLocalTitleChange(noteId: string, title: string) {
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, title } : n))
    );
  }

  function handleLocalContentChange(noteId: string, content: string) {
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, content } : n))
    );
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
            disabled={creating}
          >
            {creating ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5 mr-1.5" />
            )}
            New Note
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : notes.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6 px-3">
              No notes yet.
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
                      {note.title || 'Untitled Note'}
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
        {selectedNote ? (
          <>
            <div className="flex items-center gap-2 px-4 py-3 border-b">
              <Input
                className="font-semibold border-none shadow-none focus-visible:ring-0 px-0 text-base h-auto"
                value={selectedNote.title}
                onChange={(e) => handleLocalTitleChange(selectedNote.id, e.target.value)}
                onBlur={(e) => handleTitleBlur(selectedNote.id, e.target.value)}
                placeholder="Note title"
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
              value={selectedNote.content}
              onChange={(e) => handleLocalContentChange(selectedNote.id, e.target.value)}
              onBlur={(e) => handleContentBlur(selectedNote.id, e.target.value)}
              placeholder="Write your notes here (markdown supported)..."
            />
            <div className="px-4 py-2 border-t">
              <p className="text-xs text-muted-foreground">
                {formatDate(selectedNote.updatedAt)
                  ? `Last updated ${formatDate(selectedNote.updatedAt)}`
                  : 'Auto-saves on blur'}
              </p>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              'Select a note or create a new one'
            )}
          </div>
        )}
      </div>
    </div>
  );
}
