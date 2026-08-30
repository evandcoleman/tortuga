'use client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { BlockId } from '@/modules/newsletter/appearance/schema';

const LABELS: Record<BlockId, string> = {
  header: 'Header',
  intro: 'AI intro',
  libraries: 'Library sections',
  leaving: 'Leaving soon',
  freeform: 'Freeform block',
  actions: 'Action buttons',
  footer: 'Footer',
};

export interface BlockState {
  id: BlockId;
  enabled: boolean;
}

interface BlockEditorProps {
  blocks: BlockState[];
  onChange: (next: BlockState[]) => void;
}

export function BlockEditor({ blocks, onChange }: BlockEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex(b => b.id === active.id);
      const newIndex = blocks.findIndex(b => b.id === over.id);
      onChange(arrayMove(blocks, oldIndex, newIndex));
    }
  }

  function toggleBlock(id: BlockId) {
    onChange(blocks.map(b => (b.id === id ? { ...b, enabled: !b.enabled } : b)));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
        <ul className="m-0 list-none p-0" role="list" aria-label="Email block order">
          {blocks.map(block => (
            <SortableRow key={block.id} block={block} onToggle={() => toggleBlock(block.id)} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

interface SortableRowProps {
  block: BlockState;
  onToggle: () => void;
}

function SortableRow({ block, onToggle }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={[
        'mb-2 flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5',
        isDragging ? 'opacity-50 shadow-lg' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        aria-label={`Drag to reorder ${LABELS[block.id]}`}
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none border-none bg-transparent p-0 text-lg text-faint hover:text-muted focus-visible:outline-none"
      >
        ⠿
      </button>
      <span
        className={[
          'flex-1 text-[13px] font-medium',
          block.enabled ? 'text-fg' : 'text-faint line-through',
        ].join(' ')}
      >
        {LABELS[block.id]}
      </span>
      <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-muted">
        <input
          type="checkbox"
          checked={block.enabled}
          onChange={onToggle}
          aria-label={`${block.enabled ? 'Hide' : 'Show'} ${LABELS[block.id]}`}
          className="accent-gold"
        />
        Visible
      </label>
    </li>
  );
}
