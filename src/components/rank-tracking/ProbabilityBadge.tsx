import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ShieldCheck, Target, Rocket } from 'lucide-react';

interface ProbabilityBadgeProps {
  probability: number;
  className?: string;
  showPercentage?: boolean;
}

export function ProbabilityBadge({ probability, className, showPercentage = true }: ProbabilityBadgeProps) {
  let variant: 'safe' | 'target' | 'ambitious';
  let label: string;
  let Icon: any;

  // Logic determined by UX Research Phase 2
  if (probability >= 80) {
    variant = 'safe';
    label = 'Safe Bet';
    Icon = ShieldCheck;
  } else if (probability >= 30) {
    variant = 'target';
    label = 'Target';
    Icon = Target;
  } else {
    variant = 'ambitious';
    label = 'Ambitious';
    Icon = Rocket;
  }

  const styles = {
    safe: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20',
    target: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20',
    ambitious: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
  };

  return (
    <Badge variant="outline" className={cn("flex items-center gap-1.5 px-2.5 py-1 transition-all duration-300 hover:scale-105", styles[variant], className)}>
      <Icon className="w-3.5 h-3.5" />
      <span className="font-medium">{label}</span>
      {showPercentage && <span className="ml-1 opacity-75 text-[10px]">({probability}%)</span>}
    </Badge>
  );
}
