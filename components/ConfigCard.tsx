"use client";

import { ReactNode, createContext, useContext, useState } from "react";
import { Settings, Check } from "lucide-react";
import { Button, Card } from "./ui";

/**
 * Whether the surrounding configuration card is in edit mode. Cards read this
 * to decide if their add, edit and delete controls are shown, so the default
 * view of Configuration is a set of plain lists.
 */
const EditingContext = createContext(false);

export function useConfigEditing(): boolean {
  return useContext(EditingContext);
}

/** A titled configuration card whose controls appear only on request. */
export function ConfigCard({ title, children }: { title: string; children: ReactNode }) {
  const [editing, setEditing] = useState(false);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-foreground/50">
          {title}
        </h3>
        <Button
          size="sm"
          variant={editing ? "primary" : "outline"}
          isIconOnly
          aria-label={editing ? `Finish editing ${title}` : `Configure ${title}`}
          aria-pressed={editing}
          onPress={() => setEditing((v) => !v)}
        >
          {editing ? <Check className="h-3.5 w-3.5" /> : <Settings className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <Card className={editing ? "config-card--editing" : undefined}>
        <Card.Content className="p-4 md:p-5">
          <EditingContext.Provider value={editing}>{children}</EditingContext.Provider>
        </Card.Content>
      </Card>
    </div>
  );
}
