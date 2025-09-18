import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function SortableWord({ id, word, type, isIncorrect }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging, // This property tells us if this specific item is being dragged
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // When this item is being dragged, hide it. The DragOverlay will render the clone.
    opacity: isDragging ? 0 : 1,
  };
  
  // We remove the 'dragging' class here since the overlay will handle the visual representation
  const className = `word-tile ${type === 'punctuation' ? 'punctuation-tile' : ''} ${isIncorrect ? 'incorrect' : ''}`;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={className}>
      {word}
    </div>
  );
}