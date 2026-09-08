import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

/** Per-section empty state; the "Filter zurücksetzen" link sits once above the sections. */
export const ListEmpty = ({ title }: { title: string }) => (
  <Empty className="gap-1 py-5">
    <EmptyHeader>
      <EmptyTitle>{title}</EmptyTitle>
      <EmptyDescription>
        Suche, Status oder Filter passen zu keinem Eintrag.
      </EmptyDescription>
    </EmptyHeader>
  </Empty>
);
