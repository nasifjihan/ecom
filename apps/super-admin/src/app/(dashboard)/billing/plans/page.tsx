"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  CreditCard,
  Plus,
  Sparkles,
  Edit3,
  Archive,
  Copy,
  Users,
  List,
  Star,
  Check,
  Trash2,
  MoreHorizontal,
  Search,
  CalendarClock,
  DollarSign,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
  Button,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Input,
  Switch,
  Select,
  SelectItem,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Textarea,
  Skeleton,
} from "@/components/ui";
import { cn } from "@/components/ui";

type PlanStatus = "active" | "archived";

interface BillingPlan {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  priceMonthly: number;
  priceAnnual: number;
  trialDays: number;
  features: string[];
  ctaText: string;
  highlighted: boolean;
  sortOrder: number;
  currency: string;
  billingCycles: string[];
  status: PlanStatus;
  subscribersCount: number;
}

const mockPlans: BillingPlan[] = [
  {
    id: "plan-free",
    name: "Free",
    slug: "free",
    tagline: "Test the waters with core essentials",
    priceMonthly: 0,
    priceAnnual: 0,
    trialDays: 0,
    features: ["100 Products", "1 Staff User", "1 GB Storage", "SSL Certificate", "Email Support"],
    ctaText: "Start Free",
    highlighted: false,
    sortOrder: 1,
    currency: "BDT",
    billingCycles: ["monthly", "annual"],
    status: "active",
    subscribersCount: 34,
  },
  {
    id: "plan-starter",
    name: "Starter",
    slug: "starter",
    tagline: "Perfect for growing small businesses",
    priceMonthly: 29,
    priceAnnual: 290,
    trialDays: 14,
    features: ["500 Products", "5 Staff Users", "20 GB Storage", "Custom Domain", "100k API Calls/mo", "Priority Email Support"],
    ctaText: "Get Started",
    highlighted: false,
    sortOrder: 2,
    currency: "USD",
    billingCycles: ["monthly", "annual"],
    status: "active",
    subscribersCount: 47,
  },
  {
    id: "plan-pro",
    name: "Pro",
    slug: "pro",
    tagline: "Scale your store with advanced features",
    priceMonthly: 99,
    priceAnnual: 990,
    trialDays: 14,
    features: ["Unlimited Products", "10 Staff Users", "100 GB Storage", "Advanced Analytics", "1M API Calls/mo", "Coupons & Flash Sales", "Phone Support"],
    ctaText: "Upgrade to Pro",
    highlighted: true,
    sortOrder: 3,
    currency: "USD",
    billingCycles: ["monthly", "annual"],
    status: "active",
    subscribersCount: 52,
  },
  {
    id: "plan-enterprise",
    name: "Enterprise",
    slug: "enterprise",
    tagline: "For high-volume stores with custom needs",
    priceMonthly: 499,
    priceAnnual: 4990,
    trialDays: 30,
    features: ["Unlimited Everything", "100 Staff Users", "Unlimited Storage", "Dedicated Account Manager", "Unlimited API Calls", "Custom Integrations", "SLA 99.99%", "24/7 Premium Support"],
    ctaText: "Contact Sales",
    highlighted: false,
    sortOrder: 4,
    currency: "USD",
    billingCycles: ["monthly", "annual", "biennial"],
    status: "active",
    subscribersCount: 19,
  },
  {
    id: "plan-basic-legacy",
    name: "Basic (Legacy)",
    slug: "basic-legacy",
    tagline: "Previous basic tier — no new signups",
    priceMonthly: 19,
    priceAnnual: 190,
    trialDays: 0,
    features: ["250 Products", "2 Staff Users", "10 GB Storage", "Standard Support"],
    ctaText: "View Plan",
    highlighted: false,
    sortOrder: 99,
    currency: "USD",
    billingCycles: ["monthly"],
    status: "archived",
    subscribersCount: 8,
  },
];

export default function SuperBillingPlansPage() {
  const [tab, setTab] = useState("active");
  const [search, setSearch] = useState("");

  const filteredPlans = mockPlans.filter(
    (p) =>
      (tab === "active" ? p.status === "active" : p.status === "archived") &&
      (p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.slug.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between flex-wrap gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Billing Plans
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Create and manage platform pricing tiers, features, and trial
            options.
          </p>
        </div>
        <Button
          onClick={() =>
            toast.success("Open create plan sheet (Demo)", {
              description: "Form for new billing plan.",
            })
          }
          className="bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Create Plan
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          { label: "Active Plans", value: "4", icon: List, color: "emerald" },
          { label: "Total Subscribers", value: "152", icon: Users, color: "blue" },
          { label: "Avg. Plan MRR", value: "$163", icon: DollarSign, color: "amber" },
          { label: "In Trial", value: "24 stores", icon: CalendarClock, color: "purple" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
          >
            <Card>
              <CardContent className="p-5 flex items-center gap-3">
                <div
                  className={cn(
                    "h-11 w-11 rounded-xl flex items-center justify-center",
                    s.color === "emerald" && "bg-emerald-500/10 text-emerald-600",
                    s.color === "blue" && "bg-blue-500/10 text-blue-600",
                    s.color === "amber" && "bg-amber-500/10 text-amber-600",
                    s.color === "purple" && "bg-purple-500/10 text-purple-600",
                  )}
                >
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {s.label}
                  </p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                    {s.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="active" className="w-full">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-4">
          <TabsList className="bg-slate-100 dark:bg-slate-800 p-1">
            <TabsTrigger
              value="active"
              onClick={() => setTab("active")}
              className={cn(
                "data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700",
                tab === "active" && "shadow-sm",
              )}
            >
              <List className="h-4 w-4 mr-1.5" />
              Active Plans ({mockPlans.filter((p) => p.status === "active").length})
            </TabsTrigger>
            <TabsTrigger
              value="archived"
              onClick={() => setTab("archived")}
              className={cn(
                "data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700",
                tab === "archived" && "shadow-sm",
              )}
            >
              <Archive className="h-4 w-4 mr-1.5" />
              Archived Plans ({mockPlans.filter((p) => p.status === "archived").length})
            </TabsTrigger>
          </TabsList>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search plans..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        <TabsContent value="active" className="mt-0 space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {filteredPlans.map((plan, i) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
              >
                <Card
                  className={cn(
                    "h-full relative border-slate-200 dark:border-slate-800",
                    plan.highlighted &&
                      "ring-2 ring-rose-500 border-rose-300 dark:border-rose-800",
                  )}
                >
                  {plan.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-rose-500 to-red-500 text-white border-0 shadow-lg shadow-rose-900/30">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl font-bold">
                          {plan.name}
                        </CardTitle>
                        <CardDescription className="mt-1 text-sm">
                          {plan.tagline}
                        </CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => toast.info(`Editing: ${plan.name}`)}
                            className="cursor-pointer"
                          >
                            <Edit3 className="h-4 w-4 mr-2" />
                            Edit Plan
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => toast.success(`Duplicated: ${plan.name}`)}
                            className="cursor-pointer"
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              toast.info(
                                `Viewing subscribers on ${plan.name} (${plan.subscribersCount})`,
                              )
                            }
                            className="cursor-pointer"
                          >
                            <Users className="h-4 w-4 mr-2" />
                            View Subscribers
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => toast.warning(`Archived: ${plan.name}`)}
                            className="cursor-pointer text-amber-600 focus:text-amber-600"
                          >
                            <Archive className="h-4 w-4 mr-2" />
                            Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="mt-4 flex items-end gap-1">
                      <span className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                        ${plan.priceMonthly}
                      </span>
                      <span className="text-sm text-slate-500 dark:text-slate-400 mb-1.5">
                        /month
                      </span>
                    </div>
                    {plan.priceAnnual > 0 && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                        Save ${plan.priceMonthly * 12 - plan.priceAnnual}/year with annual billing
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="pb-2 space-y-4">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                          Trial
                        </p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {plan.trialDays}d
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                          Stores
                        </p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {plan.subscribersCount}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                          Features
                        </p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {plan.features.length}
                        </p>
                      </div>
                    </div>
                    <ul className="space-y-2">
                      {plan.features.slice(0, 5).map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-slate-600 dark:text-slate-300">
                            {feature}
                          </span>
                        </li>
                      ))}
                      {plan.features.length > 5 && (
                        <li className="text-xs text-slate-400 pl-6">
                          +{plan.features.length - 5} more features
                        </li>
                      )}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className={cn(
                        "w-full",
                        plan.highlighted
                          ? "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white"
                          : "bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100",
                      )}
                    >
                      {plan.ctaText}
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">All Plans Table</CardTitle>
              <CardDescription>
                Detailed pricing and subscriber counts
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead>Monthly</TableHead>
                    <TableHead>Annual</TableHead>
                    <TableHead>Trial</TableHead>
                    <TableHead>Stores</TableHead>
                    <TableHead>Features</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Highlighted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold",
                              plan.highlighted
                                ? "bg-gradient-to-br from-rose-500 to-red-600 text-white"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
                            )}
                          >
                            {plan.name[0]}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {plan.name}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              {plan.slug}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums">
                        ${plan.priceMonthly}
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums">
                        ${plan.priceAnnual}
                      </TableCell>
                      <TableCell>
                        <Badge variant="info" className="border-0">
                          {plan.trialDays} days
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          {plan.subscribersCount}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {plan.features.length} features
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={plan.status === "active" ? "success" : "secondary"}
                          className="border-0"
                        >
                          {plan.status === "active" ? "Active" : "Archived"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={plan.highlighted}
                          onCheckedChange={() => {}}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toast.info(`Edit: ${plan.name}`)}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toast.success(`Duplicated: ${plan.name}`)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-amber-600"
                            onClick={() => toast.warning(`Archived: ${plan.name}`)}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="archived" className="mt-0">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead>Monthly</TableHead>
                    <TableHead>Annual</TableHead>
                    <TableHead>Stores</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {plan.name}
                        </p>
                      </TableCell>
                      <TableCell>${plan.priceMonthly}</TableCell>
                      <TableCell>${plan.priceAnnual}</TableCell>
                      <TableCell>{plan.subscribersCount}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{plan.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toast.success(`Restored: ${plan.name}`)}
                        >
                          Restore
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
