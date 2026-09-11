"use client";

import * as React from "react";
import Link from "next/link";
import {
  Facebook,
  Instagram,
  Youtube,
  Twitter,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { Button, Input, Separator } from "../ui";
import { cn } from "@ecom/utils";

export type FooterProps = {
  storeName?: string;
  storeDescription?: string;
  contactInfo?: {
    address?: string;
    phone?: string;
    email?: string;
  };
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    youtube?: string;
    twitter?: string;
  };
  className?: string;
  showNewsletter?: boolean;
  onNewsletterSubmit?: (email: string) => void | Promise<void>;
};

export const Footer: React.FC<FooterProps> = ({
  storeName = "Fashion BD",
  storeDescription = "Your trusted destination for the latest fashion trends in Bangladesh. Shop clothing, shoes, accessories and more with free delivery across the country.",
  contactInfo = {
    address: "House 12, Road 5, Dhanmondi, Dhaka 1205, Bangladesh",
    phone: "+880 1700-000000",
    email: "support@fashionbd.com",
  },
  socialLinks = {
    facebook: "#",
    instagram: "#",
    youtube: "#",
    twitter: "#",
  },
  className,
  showNewsletter = true,
  onNewsletterSubmit,
}) => {
  const [email, setEmail] = React.useState("");
  const [subscribed, setSubscribed] = React.useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    onNewsletterSubmit?.(email);
    setSubscribed(true);
    setEmail("");
    setTimeout(() => setSubscribed(false), 3000);
  };

  const companyLinks = [
    { label: "About Us", href: "/about" },
    { label: "Careers", href: "/careers" },
    { label: "Press", href: "/press" },
    { label: "Blog", href: "/blog" },
  ];

  const helpLinks = [
    { label: "Shipping Info", href: "/shipping" },
    { label: "Returns & Refunds", href: "/returns" },
    { label: "FAQs", href: "/faq" },
    { label: "Contact Us", href: "/contact" },
  ];

  const categoryLinks = [
    { label: "Women", href: "/categories/women" },
    { label: "Men", href: "/categories/men" },
    { label: "Kids", href: "/categories/kids" },
    { label: "Accessories", href: "/categories/accessories" },
  ];

  const paymentIcons = [
    { name: "VISA", className: "text-blue-900 font-bold text-xs" },
    { name: "MC", className: "text-red-600 font-bold text-xs" },
    { name: "bKash", className: "text-pink-600 font-bold text-xs" },
    { name: "Nagad", className: "text-orange-500 font-bold text-xs" },
    { name: "Rocket", className: "text-purple-600 font-bold text-xs" },
    { name: "SSL", className: "text-green-700 font-bold text-xs" },
  ];

  const year = new Date().getFullYear();

  return (
    <footer className={cn("bg-slate-50 border-t", className)}>
      {showNewsletter && (
        <div className="bg-primary/5 border-b">
          <div className="container py-8 flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-foreground mb-1">Subscribe to Our Newsletter</h3>
              <p className="text-muted-foreground text-sm">Get the latest offers, new arrivals and exclusive deals delivered to your inbox.</p>
            </div>
            <form onSubmit={handleSubscribe} className="w-full lg:w-auto flex items-center gap-2 max-w-md">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  className="pl-10 w-full"
                  required
                />
              </div>
              <Button type="submit" disabled={subscribed}>
                {subscribed ? "Subscribed ✓" : "Subscribe"}
              </Button>
            </form>
          </div>
        </div>
      )}

      <div className="container py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center text-white font-bold">
                {storeName[0]}
              </div>
              <span className="font-bold text-lg tracking-tight">{storeName}</span>
            </Link>
            <p className="text-muted-foreground text-sm mb-4 max-w-sm leading-relaxed">{storeDescription}</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{contactInfo.address}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 flex-shrink-0" />
                <span>{contactInfo.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span>{contactInfo.email}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider">Company</h4>
            <ul className="space-y-2 text-sm">
              {companyLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted-foreground hover:text-foreground hover:underline transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider">Help</h4>
            <ul className="space-y-2 text-sm">
              {helpLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted-foreground hover:text-foreground hover:underline transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider">Categories</h4>
            <ul className="space-y-2 text-sm mb-6">
              {categoryLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted-foreground hover:text-foreground hover:underline transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider">Follow Us</h4>
            <div className="flex items-center gap-2">
              {socialLinks.facebook && (
                <a href={socialLinks.facebook} target="_blank" rel="noreferrer noopener" className="h-8 w-8 rounded-full bg-slate-200 hover:bg-primary hover:text-white flex items-center justify-center transition-colors">
                  <Facebook className="h-4 w-4" />
                </a>
              )}
              {socialLinks.instagram && (
                <a href={socialLinks.instagram} target="_blank" rel="noreferrer noopener" className="h-8 w-8 rounded-full bg-slate-200 hover:bg-pink-500 hover:text-white flex items-center justify-center transition-colors">
                  <Instagram className="h-4 w-4" />
                </a>
              )}
              {socialLinks.youtube && (
                <a href={socialLinks.youtube} target="_blank" rel="noreferrer noopener" className="h-8 w-8 rounded-full bg-slate-200 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors">
                  <Youtube className="h-4 w-4" />
                </a>
              )}
              {socialLinks.twitter && (
                <a href={socialLinks.twitter} target="_blank" rel="noreferrer noopener" className="h-8 w-8 rounded-full bg-slate-200 hover:bg-sky-500 hover:text-white flex items-center justify-center transition-colors">
                  <Twitter className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <div className="container py-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-2">We accept:</span>
          {paymentIcons.map((p) => (
            <div
              key={p.name}
              className={cn(
                "h-8 min-w-[3.5rem] px-2 rounded border border-slate-200 bg-white flex items-center justify-center",
                p.className,
              )}
            >
              {p.name}
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          © {year} {storeName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
