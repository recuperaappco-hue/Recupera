export function Icon({ id, size, className }: { id: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} className={className} aria-hidden="true">
      <use href={`/icons.svg#${id}`} />
    </svg>
  );
}
