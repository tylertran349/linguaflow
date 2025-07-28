import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function SortableWord({ id, word, isIncorrect }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  
  const className = `word-tile ${isIncorrect ? 'incorrect' : ''} ${isDragging ? 'dragging' : ''}`;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={className}>
      {word}
    </div>
  );
}