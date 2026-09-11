import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@ecom/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)} {...props} />
  ),
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)} {...props} />
  ),
);
Label.displayName = "Label";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success: "border-transparent bg-green-500 text-white hover:bg-green-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />
  ),
);
Skeleton.displayName = "Skeleton";

export interface SheetProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const Sheet = React.forwardRef<HTMLDivElement, SheetProps>(
  ({ className, open, onOpenChange, children, ...props }, ref) => {
    if (!open) return null;
    return (
      <div ref={ref} className="fixed inset-0 z-50" {...props}>
        <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange?.(false)} />
        <div className={cn("fixed right-0 top-0 h-full w-full sm:w-96 border-l bg-background p-6 shadow-lg animate-slide-in", className)}>
          {children}
        </div>
      </div>
    );
  },
);
Sheet.displayName = "Sheet";

export type SheetTriggerProps = {
  children: React.ReactNode;
  asChild?: boolean;
  onClick?: () => void;
};

export const SheetTrigger = ({ children, onClick }: SheetTriggerProps) => {
  return <div onClick={onClick}>{children}</div>;
};

export type SheetCloseProps = {
  children: React.ReactNode;
  onClick?: () => void;
};

export const SheetClose = ({ children, onClick }: SheetCloseProps) => (
  <button onClick={onClick}>{children}</button>
);

export const SheetContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("h-full flex flex-col", className)}>{children}</div>
);

export const SheetHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("mb-4", className)}>{children}</div>
);

export const SheetTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <h2 className={cn("text-lg font-semibold", className)}>{children}</h2>
);

export const SheetDescription = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>
);

export const SheetFooter = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("mt-auto pt-4 space-y-2", className)}>{children}</div>
);

type TabsContextValue = { active: string | undefined; setActive: (v: string) => void };
const TabsContext = React.createContext<TabsContextValue | null>(null);

export type TabsProps = {
  children: React.ReactNode;
  defaultValue?: string;
  className?: string;
};

export const Tabs = ({ children, defaultValue, className }: TabsProps) => {
  const [active, setActive] = React.useState<string | undefined>(defaultValue);
  const value = React.useMemo(() => ({ active, setActive }), [active]);
  return <TabsContext.Provider value={value}><div className={className}>{children}</div></TabsContext.Provider>;
};

export const TabsList = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground", className)}>{children}</div>
);

export type TabsTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  value: string;
  className?: string;
};

export const TabsTrigger = ({ children, value, className, ...rest }: TabsTriggerProps) => {
  const ctx = React.useContext(TabsContext);
  const active = ctx?.active === value;
  return (
    <button
      type="button"
      onClick={() => ctx?.setActive(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active ? "bg-background text-foreground shadow-sm" : "",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
};

export type TabsContentProps = {
  children: React.ReactNode;
  value: string;
  className?: string;
};

export const TabsContent = ({ children, value, className }: TabsContentProps) => {
  const ctx = React.useContext(TabsContext);
  if (ctx?.active !== value) return null;
  return <div className={cn("mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className)}>{children}</div>;
};

export const Accordion = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("space-y-2", className)}>{children}</div>
);

export const AccordionItem = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("border-b", className)}>{children}</div>
);

export const AccordionTrigger = ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => (
  <button type="button" onClick={onClick} className={cn("flex w-full items-center justify-between py-4 font-medium transition-all hover:underline", className)}>
    {children}
  </button>
);

export const AccordionContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("pb-4 pt-0 text-sm", className)}>{children}</div>
);

export const Avatar = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}>{children}</div>
);

export const AvatarImage = ({ src, alt, className }: { src?: string; alt?: string; className?: string }) => (
  <img src={src} alt={alt} className={cn("aspect-square h-full w-full", className)} />
);

export const AvatarFallback = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)}>{children}</div>
);

export type DropdownMenuProps = {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

export const DropdownMenu = ({ children, className }: DropdownMenuProps) => (
  <div className={cn("relative inline-block", className)}>{children}</div>
);

export type DropdownMenuTriggerProps = {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
};

export const DropdownMenuTrigger = ({ children, onClick, className }: DropdownMenuTriggerProps) => (
  <div onClick={onClick} className={cn("inline-block", className)}>{children}</div>
);

export type DropdownMenuContentProps = {
  children: React.ReactNode;
  open?: boolean;
  className?: string;
};

export const DropdownMenuContent = ({ children, open, className }: DropdownMenuContentProps) => {
  if (!open) return null;
  return (
    <div
      className={cn(
        "absolute right-0 z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-fade-in",
        className,
      )}
    >
      {children}
    </div>
  );
};

export type DropdownMenuItemProps = {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
};

export const DropdownMenuItem = ({ children, onClick, className }: DropdownMenuItemProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full text-left",
      className,
    )}
  >
    {children}
  </button>
);

export const DropdownMenuLabel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("px-2 py-1.5 text-sm font-semibold", className)}>{children}</div>
);

export const DropdownMenuSeparator = ({ className }: { className?: string }) => <div className={cn("-mx-1 my-1 h-px bg-muted", className)} />;

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  value?: string;
  onValueChange?: (v: string) => void;
  children: React.ReactNode;
};

export const Select = ({ children, value, onValueChange, className, ...rest }: SelectProps) => (
  <div className={cn("relative", className)}>
    <select
      value={value ?? rest.defaultValue ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none pr-8"
      {...rest}
    >
      {children}
    </select>
  </div>
);

export const SelectTrigger = ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>;
export const SelectValue = ({ children, className }: { children: React.ReactNode; className?: string }) => <span className={className}>{children}</span>;
export const SelectContent = ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>;

export type SelectItemProps = {
  children: React.ReactNode;
  value: string;
  className?: string;
};

export const SelectItem = ({ children, value, className }: SelectItemProps) => (
  <option value={value} className={cn(className)}>{children}</option>
);

export type SliderProps = {
  value: number[];
  onValueChange?: (v: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
};

export const Slider = ({ value, onValueChange, min = 0, max = 100, step = 1, className }: SliderProps) => {
  const [localVal, setLocalVal] = React.useState(value);
  React.useEffect(() => setLocalVal(value), [value]);

  const handleChange = (idx: number, val: number) => {
    const next = [...localVal];
    next[idx] = val;
    setLocalVal(next);
    onValueChange?.(next);
  };

  return (
    <div className={cn("relative flex w-full touch-none select-none items-center py-4", className)}>
      <div className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
        <div
          className="absolute h-full bg-primary"
          style={{
            left: `${((localVal[0]! - min) / (max - min)) * 100}%`,
            right: `${100 - ((localVal[1]! - min) / (max - min)) * 100}%`,
          }}
        />
      </div>
      {localVal.map((v, idx) => (
        <input
          key={idx}
          type="range"
          min={min}
          max={max}
          step={step}
          value={v}
          onChange={(e) => handleChange(idx, Number(e.target.value))}
          className="absolute w-full h-2 opacity-0 cursor-pointer"
        />
      ))}
      {localVal.map((v, idx) => (
        <div
          key={`thumb-${idx}`}
          className="absolute block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          style={{ left: `calc(${((v - min) / (max - min)) * 100}% - 10px)` }}
        />
      ))}
    </div>
  );
};

export type FormProps = {
  children: React.ReactNode;
  className?: string;
  onSubmit?: React.FormEventHandler;
};

export const Form = ({ children, className, onSubmit }: FormProps) => (
  <form onSubmit={onSubmit} className={className}>{children}</form>
);

export const FormItem = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("space-y-2", className)}>{children}</div>
);

export const FormLabel = ({ children, className }: { children: React.ReactNode; className?: string }) => <Label className={className}>{children}</Label>;
export const FormControl = ({ children }: { children: React.ReactNode }) => <>{children}</>;

export const FormDescription = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>
);

export const FormMessage = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <p className={cn("text-sm font-medium text-destructive", className)}>{children}</p>
);

export type DialogProps = {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

export const Dialog = ({ children, open, onOpenChange, className }: DialogProps) => {
  if (!open) return null;
  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center", className)}>
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange?.(false)} />
      <div className="relative z-50 w-full max-w-lg border bg-background p-6 shadow-lg rounded-lg animate-fade-in mx-4">
        {children}
      </div>
    </div>
  );
};

export type DialogTriggerProps = { children: React.ReactNode; onClick?: () => void };
export const DialogTrigger = ({ children, onClick }: DialogTriggerProps) => <div onClick={onClick}>{children}</div>;
export const DialogContent = ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>;
export const DialogHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={cn("mb-4", className)}>{children}</div>;
export const DialogFooter = ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={cn("mt-4 flex justify-end space-x-2", className)}>{children}</div>;
export const DialogTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => <h2 className={cn("text-lg font-semibold", className)}>{children}</h2>;
export const DialogDescription = ({ children, className }: { children: React.ReactNode; className?: string }) => <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>;

export const ScrollArea = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("relative overflow-auto", className)}>{children}</div>
);

export const Pagination = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <nav role="navigation" aria-label="pagination" className={cn("mx-auto flex w-full justify-center", className)}>
    <ul className="flex flex-row items-center gap-1">{children}</ul>
  </nav>
);

export const PaginationContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <ul className={cn("flex flex-row items-center gap-1", className)}>{children}</ul>
);

export const PaginationItem = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <li className={className}>{children}</li>
);

export type PaginationLinkProps = {
  children: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
};

export const PaginationLink = ({ children, isActive, onClick, className }: PaginationLinkProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={isActive ? "page" : undefined}
    className={cn(
      "inline-flex h-9 min-w-9 items-center justify-center rounded-md px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
      isActive ? "bg-primary text-primary-foreground hover:bg-primary/90" : "",
      className,
    )}
  >
    {children}
  </button>
);

export type PaginationDirectionProps = {
  children?: React.ReactNode;
  onClick?: () => void;
  className?: string;
};

export const PaginationPrevious = ({ children, onClick, className }: PaginationDirectionProps) => (
  <button type="button" onClick={onClick} className={cn("inline-flex h-9 items-center gap-1 rounded-md px-3 text-sm hover:bg-accent hover:text-accent-foreground", className)}>
    {children || "Previous"}
  </button>
);

export const PaginationNext = ({ children, onClick, className }: PaginationDirectionProps) => (
  <button type="button" onClick={onClick} className={cn("inline-flex h-9 items-center gap-1 rounded-md px-3 text-sm hover:bg-accent hover:text-accent-foreground", className)}>
    {children || "Next"}
  </button>
);

export const PaginationEllipsis = ({ className }: { className?: string }) => (
  <span className={cn("flex h-9 w-9 items-center justify-center", className)}>...</span>
);

export type CheckboxProps = {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
};

export const Checkbox = ({ checked, onCheckedChange, className }: CheckboxProps) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    onClick={() => onCheckedChange?.(!checked)}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      checked ? "bg-primary text-primary-foreground" : "",
      className,
    )}
  >
    {checked && (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    )}
  </button>
);

export type SeparatorProps = {
  className?: string;
  orientation?: "horizontal" | "vertical";
};

export const Separator = ({ className, orientation = "horizontal" }: SeparatorProps) => (
  <div
    className={cn(
      "shrink-0 bg-border",
      orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
      className,
    )}
  />
);
