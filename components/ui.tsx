"use client";

/**
 * Thin compatibility layer: the HeroUI component API this app was written
 * against, implemented on IBM Carbon (@carbon/react). Keeping the old prop
 * names (onPress, isDisabled, isIconOnly, …) means the rest of the codebase
 * doesn't need to change when the underlying library does.
 */

import { ReactNode, useId } from "react";
import {
  Button as CarbonButton,
  TextInput,
  Tile,
  Tag,
  Toggle,
} from "@carbon/react";

/* ------------------------------- Button -------------------------------- */

type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "soft";

const KIND: Record<ButtonVariant, "primary" | "secondary" | "tertiary" | "ghost" | "danger"> = {
  primary: "primary",
  secondary: "secondary",
  outline: "tertiary",
  ghost: "ghost",
  danger: "danger",
  soft: "secondary",
};

export function Button({
  variant = "primary",
  size = "md",
  isIconOnly,
  isDisabled,
  onPress,
  className,
  children,
  type,
  style,
  ...rest
}: {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  isIconOnly?: boolean;
  isDisabled?: boolean;
  onPress?: () => void;
  className?: string;
  children?: ReactNode;
  type?: "button" | "submit" | "reset";
  style?: React.CSSProperties;
  "aria-label"?: string;
}) {
  const ariaLabel = (rest as Record<string, unknown>)["aria-label"] as string | undefined;
  return (
    <CarbonButton
      kind={KIND[variant]}
      size={size}
      disabled={isDisabled}
      onClick={onPress}
      className={[isIconOnly ? "btn-icon-only" : "", className].filter(Boolean).join(" ")}
      type={type}
      style={style}
      hasIconOnly={isIconOnly}
      iconDescription={isIconOnly ? (ariaLabel ?? "button") : undefined}
      aria-label={ariaLabel}
    >
      {children}
    </CarbonButton>
  );
}

/* -------------------------------- Input --------------------------------- */

export function Input({
  className,
  type,
  step,
  placeholder,
  value,
  onChange,
  autoFocus,
  autoComplete,
  ...rest
}: {
  className?: string;
  type?: string;
  step?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
  autoComplete?: string;
  "aria-label"?: string;
}) {
  const id = useId();
  const ariaLabel = (rest as Record<string, unknown>)["aria-label"] as string | undefined;
  return (
    <TextInput
      id={id}
      labelText={ariaLabel ?? placeholder ?? ""}
      hideLabel
      className={className}
      type={type}
      step={step}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      autoFocus={autoFocus}
      autoComplete={autoComplete}
    />
  );
}

/* --------------------------------- Card --------------------------------- */

function CardRoot({ children, className }: { children?: ReactNode; className?: string }) {
  return <Tile className={["card !p-0", className].filter(Boolean).join(" ")}>{children}</Tile>;
}
function CardContent({ children, className }: { children?: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
export const Card = Object.assign(CardRoot, { Content: CardContent });

/* --------------------------------- Chip --------------------------------- */

function ChipRoot({
  children,
  className,
  size = "sm",
}: {
  children?: ReactNode;
  className?: string;
  size?: "sm" | "md";
  variant?: string;
}) {
  return (
    <Tag size={size} type="gray" className={className}>
      {children}
    </Tag>
  );
}
function ChipLabel({ children, className }: { children?: ReactNode; className?: string }) {
  return <span className={className}>{children}</span>;
}
export const Chip = Object.assign(ChipRoot, { Label: ChipLabel });

/* -------------------------------- Switch -------------------------------- */

function SwitchRoot({
  isSelected,
  onChange,
  ...rest
}: {
  isSelected?: boolean;
  onChange?: (selected: boolean) => void;
  children?: ReactNode;
  "aria-label"?: string;
}) {
  const id = useId();
  const ariaLabel = (rest as Record<string, unknown>)["aria-label"] as string | undefined;
  return (
    <Toggle
      id={id}
      size="sm"
      aria-label={ariaLabel ?? "toggle"}
      labelA=""
      labelB=""
      hideLabel
      toggled={!!isSelected}
      onToggle={(v: boolean) => onChange?.(v)}
    />
  );
}
const Noop = ({ children }: { children?: ReactNode }) => <>{children}</>;
export const Switch = Object.assign(SwitchRoot, { Control: Noop, Thumb: () => null });
