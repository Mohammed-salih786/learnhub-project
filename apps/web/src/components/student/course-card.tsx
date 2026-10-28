import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function CourseCard({
  title,
  category,
  level,
  learners,
  price,
  isPremium,
  image,
  href
}: {
  title: string;
  category: string;
  level: string;
  learners: number;
  price: string;
  isPremium?: boolean;
  image: string;
  href: string;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <img src={image} alt="" className="h-32 w-full object-cover" />
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Badge variant="secondary">{category}</Badge>
          {isPremium ? <Badge>Premium</Badge> : <Badge variant="outline">Free preview</Badge>}
        </div>
        <h3 className="text-xl font-bold">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">Level: {level}</p>
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>{learners} learners</span>
          <span className="font-semibold text-foreground">{price}</span>
        </div>
        <a href={href} className={`${buttonVariants({ variant: "default" })} mt-5 w-full`}>
          View course
        </a>
      </div>
    </Card>
  );
}
