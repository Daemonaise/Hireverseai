'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import type { ThreadMessage } from '@/types/hub';
import { formatTime, formatShortDate } from '@/lib/timestamp';

interface MessageBubbleProps {
  message: ThreadMessage;
  currentUserId: string;
  currentLocale: string;
  onRetryTranslation?: (messageId: string) => void;
}

export function MessageBubble({
  message,
  currentUserId,
  currentLocale,
  onRetryTranslation,
}: MessageBubbleProps) {
  const t = useTranslations('messaging');
  const [showOriginal, setShowOriginal] = useState(false);
  const isOwn = message.authorId === currentUserId;

  const translation = message.translations[currentLocale as 'en' | 'es' | 'ru'];
  const hasTranslation = !!translation;
  const needsTranslation = message.originalLocale !== currentLocale && !hasTranslation;

  const displayText = showOriginal || !hasTranslation
    ? message.originalText
    : translation;

  return (
    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} mb-3`}>
      <div
        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
          isOwn
            ? 'bg-primary text-primary-foreground'
            : 'bg-gray-100 text-foreground'
        }`}
      >
        {displayText}
      </div>
      <div className="flex items-center gap-2 mt-1">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {isOwn ? t('you') : message.authorRole === 'client' ? t('client') : t('freelancer')}
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          {formatShortDate(message.createdAt)} {formatTime(message.createdAt)}
        </span>
        {hasTranslation && (
          <button
            onClick={() => setShowOriginal(!showOriginal)}
            className="text-[10px] text-primary hover:underline"
          >
            {showOriginal ? t('showTranslation') : t('showTranslation')}
          </button>
        )}
        {needsTranslation && onRetryTranslation && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-[10px] px-1"
            onClick={() => onRetryTranslation(message.id)}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            {t('retryTranslation')}
          </Button>
        )}
      </div>
    </div>
  );
}
