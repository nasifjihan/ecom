import type { Metadata } from "next";
import {
  Heart,
  Users,
  Award,
  Globe,
  ShoppingBag,
  Star,
  MapPin,
  Target,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, Badge, Button } from "@ecom/storefront-base";
import Link from "next/link";

const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://fashionbd.example.com";

export const metadata: Metadata = {
  title: "About Us — Fashion BD",
  description:
    "Learn about Fashion BD — Bangladesh's leading online fashion destination. Discover our story, values, and commitment to quality, style, and exceptional customer service since 2018.",
  keywords: [
    "about fashion bd",
    "online store bangladesh",
    "fashion bd story",
    "best clothing store dhaka",
    "ecommerce company bd",
  ],
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About Us | Fashion BD — Bangladesh's Fashion Destination",
    description:
      "Discover Fashion BD's journey from a small boutique in Dhaka to Bangladesh's most loved online fashion store. Premium quality, curated styles, nationwide delivery.",
    url: "/about",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "About Us | Fashion BD",
    description:
      "Fashion BD — Curating the best of Bangladeshi and international fashion since 2018.",
  },
};

const orgSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Fashion BD",
  url: SITE_BASE,
  logo: `${SITE_BASE}/logo.png`,
  description:
    "Bangladesh's leading online fashion store for clothing, footwear, accessories, and lifestyle products.",
  founded: "2018",
  founders: [
    { "@type": "Person", name: "Fashion BD Founders" },
  ],
  sameAs: [
    "https://facebook.com/fashionbd",
    "https://instagram.com/fashionbd",
    "https://youtube.com/@fashionbd",
  ],
  address: {
    "@type": "PostalAddress",
    streetAddress: "House #42, Road #11, Banani",
    addressLocality: "Dhaka",
    postalCode: "1213",
    addressCountry: "BD",
  },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+8809612345678",
    contactType: "Customer Support",
    areaServed: "BD",
    availableLanguage: ["English", "Bengali"],
  },
};

const STATS = [
  { icon: <Users className="h-6 w-6" />, label: "Happy Customers", value: "500K+" },
  { icon: <ShoppingBag className="h-6 w-6" />, label: "Products Curated", value: "10,000+" },
  { icon: <MapPin className="h-6 w-6" />, label: "Cities Served", value: "64" },
  { icon: <Star className="h-6 w-6" />, label: "5-Star Reviews", value: "98%" },
];

const VALUES = [
  {
    icon: <Heart className="h-8 w-8" />,
    title: "Customer First",
    description:
      "Everything we do starts with our customers. From product curation to after-sales support, your satisfaction is our priority.",
  },
  {
    icon: <Award className="h-8 w-8" />,
    title: "Quality Assured",
    description:
      "Every product goes through 3-stage quality check before packaging. 100% authentic brands, no knock-offs — guaranteed.",
  },
  {
    icon: <Sparkles className="h-8 w-8" />,
    title: "Curated Style",
    description:
      "Our in-house stylists hand-pick every item. We stock only what we'd proudly wear ourselves.",
  },
  {
    icon: <Globe className="h-8 w-8" />,
    title: "Nationwide Delivery",
    description:
      "From Teknaf to Tetulia — we deliver all 64 districts of Bangladesh with tracking & reliable carriers.",
  },
  {
    icon: <TrendingUp className="h-8 w-8" />,
    title: "Fair Pricing",
    description:
      "Direct partnerships with manufacturers mean you get premium quality without boutique markup. Transparent pricing, always.",
  },
  {
    icon: <Target className="h-8 w-8" />,
    title: "Sustainable Vision",
    description:
      "We're transitioning to eco-friendly packaging and expanding our sustainable fashion collection every season.",
  },
];

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        id="org-schema-about"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
      />
      <div className="container py-8 md:py-14 max-w-6xl">
        <div className="text-center mb-12 max-w-3xl mx-auto">
          <Badge variant="secondary" className="mb-4 text-xs uppercase tracking-wider">
            About Fashion BD
          </Badge>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-4">
            Where Style Meets <span className="text-primary">Bangladesh</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Since 2018, Fashion BD has been on a mission to bring world-class fashion to every corner of Bangladesh —
            at prices that make sense, with service that makes you smile.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14">
          {STATS.map((s) => (
            <Card key={s.label} className="text-center bg-gradient-to-br from-card to-primary/5">
              <CardContent className="p-5 md:p-6">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                  {s.icon}
                </div>
                <div className="text-2xl md:text-3xl font-black text-primary mb-1">{s.value}</div>
                <div className="text-xs md:text-sm text-muted-foreground font-medium">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-10 items-center mb-16">
          <div className="space-y-5">
            <Badge variant="default" className="text-xs">Our Story</Badge>
            <h2 className="text-2xl md:text-4xl font-bold leading-tight">
              From a tiny boutique in Banani to the hearts of 500,000+ Bangladeshis.
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Fashion BD started in 2018 as a 200 sqft boutique with a simple idea: Bangladesh deserves
              better fashion at better prices. What began with 3 racks of curated shirts and 1 part-time
              courier has grown into a team of 80+ passionate people serving customers in every single district.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Today, we partner with over 150 local manufacturers and 30+ international brands to bring you
              the best of both worlds. Every order is packed by hand in our 12,000 sqft fulfillment center in Tongi,
              shipped within 24 hours, and backed by a 7-day no-questions-asked return policy.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button size="lg" asChild>
                <Link href="/products">Shop Our Collection</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/contact">Get in Touch</Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <img
              src="https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=fashion%20boutique%20store%20interior%20dhaka%20bangladesh%20modern%20clothing%20racks%20warm%20lighting&image_size=portrait_4_3&cache=about1"
              alt="Fashion BD Store"
              className="rounded-2xl w-full aspect-[4/5] object-cover border"
            />
            <div className="space-y-3 pt-8">
              <img
                src="https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=bengali%20fashion%20model%20wearing%20elegant%20saree%20studio%20portrait%20professional&image_size=portrait_4_3&cache=about2"
                alt="Fashion Model"
                className="rounded-2xl w-full aspect-[4/5] object-cover border"
              />
            </div>
          </div>
        </div>

        <div className="mb-16">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <Badge variant="secondary" className="mb-3 uppercase tracking-wider">What We Stand For</Badge>
            <h2 className="text-2xl md:text-4xl font-bold mb-3">Our Core Values</h2>
            <p className="text-muted-foreground">
              Six principles that guide every decision we make — from which products to stock, to how we answer your calls at 9 PM on a Friday.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {VALUES.map((v) => (
              <Card key={v.title} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                    {v.icon}
                  </div>
                  <h3 className="text-lg font-bold mb-2">{v.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{v.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Card className="bg-gradient-to-br from-primary/10 via-background to-secondary/10 border-primary/20">
          <CardContent className="p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="md:max-w-xl">
              <h2 className="text-2xl md:text-3xl font-bold mb-2">
                Ready to start your Fashion BD journey?
              </h2>
              <p className="text-muted-foreground md:text-lg">
                Join 500,000+ happy Bangladeshis who shop smarter with Fashion BD. New customers get 10% OFF on their first order.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
              <Button size="lg" asChild>
                <Link href="/products">Shop Now</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/faq">Read FAQ</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
