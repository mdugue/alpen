import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export function ListEmpty({ title, onReset }: { title: string; onReset: () => void }) {
  return (
    <Empty className="gap-2 py-6">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm" variant="outline" onClick={onReset}>
          Filter zurücksetzen
        </Button>
      </EmptyContent>
    </Empty>
  );
}
