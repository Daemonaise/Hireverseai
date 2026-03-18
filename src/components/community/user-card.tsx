interface UserCardProps {
  name: string;
  level: number;
  levelTitle: string;
}

export function UserCard({ name, level, levelTitle }: UserCardProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
        {name.charAt(0).toUpperCase()}
      </div>
      <div>
        <span className="text-sm font-medium">{name}</span>
        <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          Lv.{level} {levelTitle}
        </span>
      </div>
    </div>
  );
}
