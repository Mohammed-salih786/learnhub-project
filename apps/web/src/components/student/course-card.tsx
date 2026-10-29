import Image from "next/image";
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
    <Card className="overflow-hidden p-0 transition-transform hover:-translate-y-1 hover:shadow-soft">
      <Image src={image} alt="" width={800} height={450} className="h-40 w-full object-cover sm:h-32" />
      <div className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Badge variant="secondary">{category}</Badge>
          {isPremium ? <Badge>Premium</Badge> : <Badge variant="outline">Free preview</Badge>}
        </div>
        <h3 className="text-lg font-bold sm:text-xl">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">Level: {level}</p>
        <div className="mt-4 flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:gap-0">
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
