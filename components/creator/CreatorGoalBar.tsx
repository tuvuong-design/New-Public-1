import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function CreatorGoalBar({
  title,
  currentStars,
  targetStars,
}: {
  title: string;
  currentStars: number;
  targetStars: number;
}) {
  const cur = Math.max(0, Number.isFinite(currentStars) ? currentStars : 0);
  const tgt = Math.max(0, Number.isFinite(targetStars) ? targetStars : 0);

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-neutral-600">
          {cur} / {tgt} ⭐
        </div>
      </div>
      <div className="mt-2">
        <Progress value={cur} max={tgt || 1} />
      </div>
    </Card>
  );
}
