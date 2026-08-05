"use client";

import { ReactNode, createContext, useCallback, useContext, useState } from "react";
import { Settings, Check } from "./icons";
import { Button, Card } from "./ui";

/**
 * Whether the surrounding configuration card is in edit mode. Cards read this
 * to decide if their add, edit and delete controls are shown, so the default
 * view of Configuration is a set of plain lists.
 */
const EditingContext = createContext(false);

/**
 * Lets a card close its own editing mode. The list cards have no use for it —
 * renaming one category then deleting another is one visit — but a card that
 * is a single form with a Save button is finished the moment it is pressed,
 * and should not need the gear pressed a second time to say so.
 */
const SetEditingContext = createContext<(on: boolean) => void>(() => {});

export function useConfigEditing(): boolean {
  return useContext(EditingContext);
}

export function useSetConfigEditing(): (on: boolean) => void {
  return useContext(SetEditingContext);
}

/** A titled configuration card whose controls appear only on request. */
export function ConfigCard({ title, children }: { title: string; children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  // Stable, so a card can depend on it without re-running effects.
  const set = useCallback((on: boolean) => setEditing(on), []);

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
          <EditingContext.Provider value={editing}>
            <SetEditingContext.Provider value={set}>{children}</SetEditingContext.Provider>
          </EditingContext.Provider>
        </Card.Content>
      </Card>
    </div>
  );
}
