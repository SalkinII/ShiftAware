import { cn } from "@/lib/utils";

interface Member {
  alias: string;
  avatarId?: string;
}

interface AvatarStackProps {
  members: Member[];
  max?: number;
  size?: "sm" | "md";
  className?: string;
}

// Generate consistent gradient colors from alias
function getGradientColors(alias: string): [string, string] {
  const colors = [
    ["from-blue-400", "to-blue-600"],
    ["from-purple-400", "to-purple-600"],
    ["from-green-400", "to-green-600"],
    ["from-orange-400", "to-orange-600"],
    ["from-pink-400", "to-pink-600"],
    ["from-cyan-400", "to-cyan-600"],
  ];
  const index = alias.charCodeAt(0) % colors.length;
  return colors[index] as [string, string];
}

function getInitials(alias: string): string {
  return alias
    .split(/[\s_-]/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function AvatarStack({ members, max = 3, size = "sm", className }: AvatarStackProps) {
  const displayed = members.slice(0, max);
  const remaining = members.length - max;

  const sizeClasses = {
    sm: "w-6 h-6 text-[10px]",
    md: "w-8 h-8 text-xs",
  };

  return (
    <div className={cn("flex -space-x-2", className)}>
      {displayed.map((member) => {
        const [from, to] = getGradientColors(member.alias);
        return (
          <div
            key={member.alias}
            className={cn(
              "rounded-full bg-gradient-to-br border-2 border-white flex items-center justify-center text-white font-medium",
              from,
              to,
              sizeClasses[size]
            )}
            title={member.alias}
          >
            {member.avatarId || getInitials(member.alias)}
          </div>
        );
      })}
      {remaining > 0 && (
        <div
          className={cn(
            "rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-gray-600 font-medium",
            sizeClasses[size]
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
