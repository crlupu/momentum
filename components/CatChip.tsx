"use client";

import { Chip } from "@heroui/react";
import type { Category } from "@/lib/tracker";

export function CatChip({
  category,
  onPress,
  selected,
}: {
  category: Category;
  onPress?: () => void;
  selected?: boolean;
}) {
  return (
    <Chip
      size="sm"
      variant="soft"
      onClick={onPress}
      className={
        "cursor-default select-none " +
        (onPress ? "cursor-pointer " : "") +
        (selected === false ? "opacity-45 " : "")
      }
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: category.color }}
        aria-hidden
      />
      <Chip.Label className="ml-1.5">{category.name}</Chip.Label>
    </Chip>
  );
}
