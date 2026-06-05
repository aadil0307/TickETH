'use client';

interface PageHeaderProps {
  category?: string;
  title: string;
  highlight?: string;
  /** When true the gradient highlight renders before the title text. */
  highlightFirst?: boolean;
  description?: string;
  right?: React.ReactNode;
}

export function PageHeader({ category, title, highlight, highlightFirst, description, right }: PageHeaderProps) {
  const grad = highlight && (
    <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{highlight}</span>
  );
  return (
    <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        {category && (
          <span className="text-xs font-bold text-primary uppercase tracking-[0.3em]">{category}</span>
        )}
        <h1 className="mt-2 text-4xl font-extrabold">
          {highlightFirst ? <>{grad}{' '}{title}</> : <>{title}{' '}{grad}</>}
        </h1>
        {description && <p className="mt-1 text-muted">{description}</p>}
      </div>
      {right}
    </div>
  );
}
