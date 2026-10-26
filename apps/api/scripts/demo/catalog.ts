/**
 * The demo shop's catalogue: categories, invented brands and the products each category holds.
 * Names, prices and details are made up but typical of a Bangladeshi fashion shop.
 */
import type { PhotoPool } from "./photos"

export const SHOP = {
  name: "Rongtuli",
  slug: "rongtuli",
  tagline: "Everyday Bangladeshi fashion, delivered to your door",
  taglineBn: "প্রতিদিনের বাংলাদেশি ফ্যাশন, পৌঁছে যাবে আপনার দরজায়",
  phone: "+880 1700-000111",
  email: "hello@rongtuli.test",
  address: ["House 21, Road 7, Block C", "Banani"],
  city: "Dhaka",
  postalCode: "1213",
  orderPrefix: "RT",
  colors: { primary: "#9d174d", secondary: "#334155", accent: "#d97706", surface: "#fdf8f6", text: "#1c1917" },
  fonts: { heading: "Playfair Display", body: "Inter" },
}

export const BRANDS: { slug: string; name: string; bn: string }[] = [
  { slug: "tantubay", name: "Tantubay", bn: "তন্তুবায়" },
  { slug: "dhaka-loom", name: "Dhaka Loom", bn: "ঢাকা লুম" },
  { slug: "shapla-studio", name: "Shapla Studio", bn: "শাপলা স্টুডিও" },
  { slug: "nodi", name: "Nodi", bn: "নদী" },
  { slug: "urban-kotha", name: "Urban Kotha", bn: "আরবান কথা" },
  { slug: "bunon", name: "Bunon", bn: "বুনন" },
  { slug: "chokro", name: "Chokro", bn: "চক্র" },
  { slug: "pathchola", name: "Pathchola", bn: "পথচলা" },
  { slug: "kolorob-kids", name: "Kolorob Kids", bn: "কলরব কিডস" },
  { slug: "jhinuk", name: "Jhinuk", bn: "ঝিনুক" },
]

export interface TopCategory { slug: string; name: string; bn: string; pool: PhotoPool }
export const TOP_CATEGORIES: TopCategory[] = [
  { slug: "women", name: "Women", bn: "নারী", pool: "saree" },
  { slug: "men", name: "Men", bn: "পুরুষ", pool: "panjabi" },
  { slug: "kids", name: "Kids", bn: "শিশু", pool: "kids" },
  { slug: "accessories", name: "Accessories", bn: "এক্সেসরিজ", pool: "bag" },
  { slug: "footwear", name: "Footwear", bn: "জুতা", pool: "mensShoes" },
]

type Variants = "size" | "size+color" | "color" | "none"
export interface CategorySpec {
  slug: string
  name: string
  bn: string
  parent: string
  pool: PhotoPool
  brands: string[]
  /** [English base name, Bangla base name] */
  items: [string, string][]
  colors: [string, string][]
  sizes?: string[]
  variants: Variants
  price: [number, number]
  weight: number
  specs: [string, string][]
  care: string
  blurb: string
}

const C = (en: string, bn: string): [string, string] => [en, bn]
const COLORS = {
  warm: [C("Maroon", "মেরুন"), C("Mustard", "মাস্টার্ড"), C("Rust", "মরিচা"), C("Red", "লাল")],
  cool: [C("Navy", "নেভি"), C("Bottle Green", "বোতল সবুজ"), C("Sky Blue", "আকাশি"), C("Teal", "টিল")],
  soft: [C("Off White", "অফ হোয়াইট"), C("Beige", "বেইজ"), C("Peach", "পিচ"), C("Lavender", "ল্যাভেন্ডার")],
  basic: [C("Black", "কালো"), C("White", "সাদা"), C("Grey", "ধূসর"), C("Navy", "নেভি")],
}
const APPAREL = ["S", "M", "L", "XL"]

export const CATEGORIES: CategorySpec[] = [
  {
    slug: "sarees", name: "Sarees", bn: "শাড়ি", parent: "women", pool: "saree", brands: ["tantubay", "dhaka-loom"],
    items: [C("Handloom Jamdani Saree", "হ্যান্ডলুম জামদানি শাড়ি"), C("Tangail Cotton Saree", "টাঙ্গাইল সুতি শাড়ি"), C("Rajshahi Silk Saree", "রাজশাহী সিল্ক শাড়ি"), C("Katan Party Saree", "কাতান পার্টি শাড়ি"), C("Block Print Cotton Saree", "ব্লক প্রিন্ট সুতি শাড়ি"), C("Muslin Festive Saree", "মসলিন উৎসব শাড়ি"), C("Half Silk Saree", "হাফ সিল্ক শাড়ি")],
    colors: [...COLORS.warm, ...COLORS.cool], variants: "none", price: [2400, 18500], weight: 0.7,
    specs: [["Length", "5.5 metres with blouse piece"], ["Weave", "Handloom"], ["Origin", "Bangladesh"]],
    care: "Dry clean the first time; then gentle hand wash in cold water.",
    blurb: "Woven by hand, with a soft drape that lasts from morning tea to evening invitations.",
  },
  {
    slug: "three-piece", name: "Three-Piece", bn: "থ্রি-পিস", parent: "women", pool: "threePiece", brands: ["shapla-studio", "nodi"],
    items: [C("Printed Lawn Three-Piece", "প্রিন্টেড লন থ্রি-পিস"), C("Embroidered Cotton Three-Piece", "এমব্রয়ডারি সুতি থ্রি-পিস"), C("Georgette Party Three-Piece", "জর্জেট পার্টি থ্রি-পিস"), C("Unstitched Linen Three-Piece", "আনস্টিচড লিনেন থ্রি-পিস"), C("Karchupi Work Three-Piece", "কারচুপি কাজ থ্রি-পিস")],
    colors: [...COLORS.soft, ...COLORS.cool], sizes: ["M", "L", "XL"], variants: "size", price: [1650, 6900], weight: 0.6,
    specs: [["Set", "Kameez, salwar and orna"], ["Fabric", "Cotton lawn"], ["Fit", "Regular"]],
    care: "Hand wash separately in cold water; dry in shade.",
    blurb: "A breezy three-piece with a matching orna, cut for Dhaka summers and family visits.",
  },
  {
    slug: "kurtis", name: "Kurtis", bn: "কুর্তি", parent: "women", pool: "kurti", brands: ["nodi", "shapla-studio"],
    items: [C("Floral Print Kurti", "ফ্লোরাল প্রিন্ট কুর্তি"), C("A-Line Cotton Kurti", "এ-লাইন সুতি কুর্তি"), C("Hand-Embroidered Kurti", "হাতের কাজের কুর্তি"), C("Tiered Long Kurti", "টায়ার্ড লং কুর্তি"), C("Linen Office Kurti", "লিনেন অফিস কুর্তি"), C("Paisley Rayon Kurti", "পেইসলি রেয়ন কুর্তি")],
    colors: [...COLORS.soft, ...COLORS.warm], sizes: APPAREL, variants: "size+color", price: [890, 3290], weight: 0.3,
    specs: [["Fabric", "Cotton"], ["Sleeve", "Three-quarter"], ["Length", "Knee length"]],
    care: "Machine wash cold on gentle; iron on the reverse.",
    blurb: "Easy to wear and easy to style: with jeans for class, with palazzos for work.",
  },
  {
    slug: "hijab-abaya", name: "Hijab & Abaya", bn: "হিজাব ও আবায়া", parent: "women", pool: "hijab", brands: ["nodi"],
    items: [C("Premium Jersey Hijab", "প্রিমিয়াম জার্সি হিজাব"), C("Chiffon Everyday Hijab", "শিফন হিজাব"), C("Nida Classic Abaya", "নিদা ক্লাসিক আবায়া"), C("Embroidered Cuff Abaya", "এমব্রয়ডারি কাফ আবায়া"), C("Cotton Prayer Set", "সুতি প্রেয়ার সেট")],
    colors: [C("Black", "কালো"), C("Dusty Pink", "ডাস্টি পিংক"), C("Olive", "জলপাই"), C("Cream", "ক্রিম")], variants: "color", price: [450, 4890], weight: 0.35,
    specs: [["Fabric", "Jersey / Nida"], ["Size", "Free size"], ["Origin", "Bangladesh"]],
    care: "Hand wash in cold water; do not wring.",
    blurb: "Soft, breathable fabric that stays in place through a full day out.",
  },
  {
    slug: "panjabi", name: "Panjabi", bn: "পাঞ্জাবি", parent: "men", pool: "panjabi", brands: ["tantubay", "urban-kotha"],
    items: [C("Premium Cotton Panjabi", "প্রিমিয়াম সুতি পাঞ্জাবি"), C("Embroidered Eid Panjabi", "এমব্রয়ডারি ঈদ পাঞ্জাবি"), C("Khadi Casual Panjabi", "খাদি ক্যাজুয়াল পাঞ্জাবি"), C("Silk Blend Wedding Panjabi", "সিল্ক ব্লেন্ড বিয়ের পাঞ্জাবি"), C("Short Kabli Panjabi", "শর্ট কাবলি পাঞ্জাবি"), C("Jacquard Festive Panjabi", "জ্যাকার্ড উৎসব পাঞ্জাবি")],
    colors: [C("White", "সাদা"), C("Off White", "অফ হোয়াইট"), ...COLORS.warm.slice(0, 2), ...COLORS.cool.slice(0, 2)], sizes: ["38", "40", "42", "44", "46"], variants: "size", price: [1490, 7900], weight: 0.45,
    specs: [["Fabric", "Cotton"], ["Fit", "Regular"], ["Collar", "Band collar"]],
    care: "Machine wash cold; iron medium. Dry clean embroidered pieces.",
    blurb: "Classic cut and fine stitching for Fridays, Eid mornings and everything between.",
  },
  {
    slug: "shirts", name: "Shirts", bn: "শার্ট", parent: "men", pool: "shirt", brands: ["urban-kotha", "dhaka-loom"],
    items: [C("Slim Fit Oxford Shirt", "স্লিম ফিট অক্সফোর্ড শার্ট"), C("Formal Poplin Shirt", "ফরমাল পপলিন শার্ট"), C("Linen Casual Shirt", "লিনেন ক্যাজুয়াল শার্ট"), C("Check Flannel Shirt", "চেক ফ্লানেল শার্ট"), C("Striped Office Shirt", "স্ট্রাইপ অফিস শার্ট"), C("Denim Casual Shirt", "ডেনিম ক্যাজুয়াল শার্ট")],
    colors: [C("White", "সাদা"), C("Sky Blue", "আকাশি"), C("Navy", "নেভি"), C("Charcoal", "চারকোল")], sizes: ["M", "L", "XL", "XXL"], variants: "size+color", price: [1290, 3990], weight: 0.3,
    specs: [["Fabric", "100% cotton"], ["Fit", "Slim"], ["Sleeve", "Full"]],
    care: "Machine wash cold; tumble dry low; warm iron.",
    blurb: "Crisp from the first meeting to the last rickshaw home.",
  },
  {
    slug: "t-shirts", name: "T-Shirts", bn: "টি-শার্ট", parent: "men", pool: "tshirt", brands: ["bunon", "urban-kotha"],
    items: [C("Basic Crew Neck T-Shirt", "বেসিক ক্রু নেক টি-শার্ট"), C("Graphic Print T-Shirt", "গ্রাফিক প্রিন্ট টি-শার্ট"), C("Pique Henley T-Shirt", "পিকে হেনলি টি-শার্ট"), C("Oversized Drop Shoulder T-Shirt", "ওভারসাইজড টি-শার্ট"), C("Pack of 3 Everyday Tees", "৩টি এভরিডে টি-শার্ট")],
    colors: COLORS.basic, sizes: APPAREL, variants: "size+color", price: [450, 1590], weight: 0.2,
    specs: [["Fabric", "180 GSM combed cotton"], ["Fit", "Regular"], ["Neck", "Crew"]],
    care: "Machine wash cold inside out; do not bleach.",
    blurb: "Knitted in Gazipur from soft combed cotton that keeps its shape wash after wash.",
  },
  {
    slug: "jeans", name: "Jeans", bn: "জিন্স", parent: "men", pool: "jeans", brands: ["urban-kotha", "bunon"],
    items: [C("Slim Fit Stretch Jeans", "স্লিম ফিট স্ট্রেচ জিন্স"), C("Regular Fit Denim", "রেগুলার ফিট ডেনিম"), C("Washed Tapered Jeans", "ওয়াশড টেপারড জিন্স"), C("Dark Indigo Jeans", "ডার্ক ইন্ডিগো জিন্স")],
    colors: [C("Indigo", "ইন্ডিগো"), C("Light Wash", "লাইট ওয়াশ"), C("Black", "কালো")], sizes: ["30", "32", "34", "36"], variants: "size", price: [1490, 3490], weight: 0.6,
    specs: [["Fabric", "98% cotton, 2% elastane"], ["Rise", "Mid"], ["Closure", "Zip fly"]],
    care: "Wash inside out in cold water; line dry to keep the colour.",
    blurb: "Denim from Bangladeshi mills with just enough stretch for a long day.",
  },
  {
    slug: "polo", name: "Polo Shirts", bn: "পোলো শার্ট", parent: "men", pool: "polo", brands: ["bunon"],
    items: [C("Classic Pique Polo", "ক্লাসিক পিকে পোলো"), C("Tipped Collar Polo", "টিপড কলার পোলো"), C("Printed Summer Polo", "প্রিন্টেড সামার পোলো"), C("Long Sleeve Polo", "লং স্লিভ পোলো")],
    colors: [C("Navy", "নেভি"), C("White", "সাদা"), C("Bottle Green", "বোতল সবুজ"), C("Maroon", "মেরুন")], sizes: APPAREL, variants: "size+color", price: [790, 1890], weight: 0.25,
    specs: [["Fabric", "Cotton pique"], ["Fit", "Regular"], ["Collar", "Ribbed"]],
    care: "Machine wash cold; dry flat.",
    blurb: "Smart enough for the office, relaxed enough for the weekend adda.",
  },
  {
    slug: "boys", name: "Boys", bn: "ছেলেদের", parent: "kids", pool: "kids", brands: ["kolorob-kids"],
    items: [C("Boys Cotton Panjabi Set", "ছেলেদের সুতি পাঞ্জাবি সেট"), C("Boys Graphic T-Shirt", "ছেলেদের গ্রাফিক টি-শার্ট"), C("Boys Denim Shorts", "ছেলেদের ডেনিম শর্টস"), C("Boys Hooded Jacket", "ছেলেদের হুডি জ্যাকেট"), C("Boys Check Shirt", "ছেলেদের চেক শার্ট")],
    colors: [C("Blue", "নীল"), C("Green", "সবুজ"), C("Yellow", "হলুদ")], sizes: ["2-3Y", "4-5Y", "6-7Y", "8-9Y"], variants: "size", price: [490, 2190], weight: 0.25,
    specs: [["Fabric", "Soft cotton"], ["Age", "2–9 years"], ["Fit", "Comfort"]],
    care: "Machine wash cold with similar colours.",
    blurb: "Tough enough for the playground, soft enough for nap time.",
  },
  {
    slug: "girls", name: "Girls", bn: "মেয়েদের", parent: "kids", pool: "kids", brands: ["kolorob-kids"],
    items: [C("Girls Frock Dress", "মেয়েদের ফ্রক"), C("Girls Embroidered Three-Piece", "মেয়েদের এমব্রয়ডারি থ্রি-পিস"), C("Girls Party Gown", "মেয়েদের পার্টি গাউন"), C("Girls Printed Top & Pant", "মেয়েদের প্রিন্টেড টপ ও প্যান্ট")],
    colors: [C("Pink", "গোলাপি"), C("Lilac", "লিলাক"), C("Mint", "মিন্ট")], sizes: ["2-3Y", "4-5Y", "6-7Y", "8-9Y"], variants: "size", price: [590, 2890], weight: 0.25,
    specs: [["Fabric", "Cotton blend"], ["Age", "2–9 years"], ["Lining", "Cotton"]],
    care: "Hand wash in cold water; dry in shade.",
    blurb: "Twirl-ready dresses and sets in colours little ones pick themselves.",
  },
  {
    slug: "bags", name: "Bags", bn: "ব্যাগ", parent: "accessories", pool: "bag", brands: ["jhinuk"],
    items: [C("Leather Tote Bag", "লেদার টোট ব্যাগ"), C("Quilted Shoulder Bag", "কুইল্টেড শোল্ডার ব্যাগ"), C("Jute Shopping Bag", "পাটের শপিং ব্যাগ"), C("Crossbody Sling Bag", "ক্রসবডি স্লিং ব্যাগ"), C("Mini Party Clutch", "মিনি পার্টি ক্লাচ"), C("Office Laptop Satchel", "অফিস ল্যাপটপ স্যাচেল")],
    colors: [C("Tan", "ট্যান"), C("Black", "কালো"), C("Maroon", "মেরুন"), C("Beige", "বেইজ")], variants: "color", price: [690, 5890], weight: 0.8,
    specs: [["Material", "Genuine leather / jute"], ["Closure", "Zip"], ["Lining", "Fabric"]],
    care: "Wipe with a dry cloth; keep away from direct sun.",
    blurb: "Room for the phone, the keys, the tiffin box and the umbrella you forgot last time.",
  },
  {
    slug: "watches", name: "Watches", bn: "ঘড়ি", parent: "accessories", pool: "watch", brands: ["chokro"],
    items: [C("Classic Steel Watch", "ক্লাসিক স্টিল ঘড়ি"), C("Leather Strap Chronograph", "লেদার স্ট্র্যাপ ক্রোনোগ্রাফ"), C("Minimal Slim Watch", "মিনিমাল স্লিম ঘড়ি"), C("Gold Tone Dress Watch", "গোল্ড টোন ড্রেস ঘড়ি"), C("Diver Style Watch", "ডাইভার স্টাইল ঘড়ি")],
    colors: [C("Silver", "সিলভার"), C("Black", "কালো"), C("Gold", "গোল্ডেন")], variants: "color", price: [1990, 9900], weight: 0.2,
    specs: [["Movement", "Quartz"], ["Water resistance", "3 ATM"], ["Warranty", "1 year"]],
    care: "Keep away from water above splash level; wipe the strap dry.",
    blurb: "Clean dials and solid straps, made to be worn every day.",
  },
  {
    slug: "jewellery", name: "Jewellery", bn: "গয়না", parent: "accessories", pool: "jewellery", brands: ["jhinuk"],
    items: [C("Gold Plated Hoop Earrings", "গোল্ড প্লেটেড হুপ দুল"), C("Charm Bracelet Set", "চার্ম ব্রেসলেট সেট"), C("Layered Necklace", "লেয়ার্ড নেকলেস"), C("Stackable Ring Set", "স্ট্যাকেবল আংটি সেট"), C("Beaded Festive Necklace", "পুঁতির উৎসব নেকলেস"), C("Oxidised Jhumka", "অক্সিডাইজড ঝুমকা")],
    colors: [C("Gold", "গোল্ডেন"), C("Silver", "সিলভার")], variants: "none", price: [390, 3490], weight: 0.05,
    specs: [["Material", "Brass, gold plated"], ["Nickel", "Nickel free"], ["Pack", "Gift box"]],
    care: "Keep dry; store in the pouch; avoid perfume on the metal.",
    blurb: "Light, nickel-free pieces that turn a plain outfit into a festive one.",
  },
  {
    slug: "sunglasses", name: "Sunglasses", bn: "সানগ্লাস", parent: "accessories", pool: "sunglasses", brands: ["chokro"],
    items: [C("Classic Wayfarer Sunglasses", "ক্লাসিক ওয়েফেয়ারার সানগ্লাস"), C("Round Metal Sunglasses", "রাউন্ড মেটাল সানগ্লাস"), C("Polarised Sport Sunglasses", "পোলারাইজড স্পোর্ট সানগ্লাস"), C("Oversized Cat Eye Sunglasses", "ওভারসাইজড ক্যাট আই সানগ্লাস")],
    colors: [C("Black", "কালো"), C("Tortoise", "টরটয়েজ"), C("Gold", "গোল্ডেন")], variants: "color", price: [690, 2990], weight: 0.08,
    specs: [["Lens", "UV400"], ["Frame", "Acetate / metal"], ["Case", "Included"]],
    care: "Clean with the microfibre cloth; keep in the case.",
    blurb: "Full UV protection for long afternoons in the Dhaka sun.",
  },
  {
    slug: "mens-shoes", name: "Men's Shoes", bn: "ছেলেদের জুতা", parent: "footwear", pool: "mensShoes", brands: ["pathchola"],
    items: [C("Leather Oxford Shoes", "লেদার অক্সফোর্ড জুতা"), C("Penny Loafers", "পেনি লোফার"), C("Chelsea Boots", "চেলসি বুট"), C("Casual Leather Sandals", "ক্যাজুয়াল লেদার স্যান্ডেল"), C("Derby Office Shoes", "ডার্বি অফিস জুতা")],
    colors: [C("Brown", "বাদামি"), C("Black", "কালো")], sizes: ["39", "40", "41", "42", "43", "44"], variants: "size", price: [1890, 6490], weight: 0.9,
    specs: [["Upper", "Genuine leather"], ["Sole", "TPR"], ["Made in", "Bangladesh"]],
    care: "Polish weekly; use a shoe tree; let dry naturally if wet.",
    blurb: "Made by leather craftsmen in Hazaribagh's new tannery estate.",
  },
  {
    slug: "womens-shoes", name: "Women's Shoes", bn: "মেয়েদের জুতা", parent: "footwear", pool: "womensShoes", brands: ["pathchola"],
    items: [C("Block Heel Sandals", "ব্লক হিল স্যান্ডেল"), C("Pointed Toe Pumps", "পয়েন্টেড টো পাম্পস"), C("Flat Kolhapuri Sandals", "ফ্ল্যাট কোলাপুরি স্যান্ডেল"), C("Embellished Party Heels", "এমবেলিশড পার্টি হিল"), C("Comfort Slip-Ons", "কমফোর্ট স্লিপ-অন")],
    colors: [C("Nude", "নুড"), C("Black", "কালো"), C("Gold", "গোল্ডেন"), C("Red", "লাল")], sizes: ["36", "37", "38", "39", "40", "41"], variants: "size", price: [990, 4290], weight: 0.6,
    specs: [["Upper", "Synthetic leather"], ["Heel", "2–3 inches"], ["Insole", "Cushioned"]],
    care: "Wipe clean; store in the box away from heat.",
    blurb: "Pretty enough for a wedding, cushioned enough to dance through it.",
  },
  {
    slug: "sneakers", name: "Sneakers", bn: "স্নিকার্স", parent: "footwear", pool: "sneakers", brands: ["pathchola"],
    items: [C("Everyday White Sneakers", "এভরিডে সাদা স্নিকার্স"), C("Canvas Low-Tops", "ক্যানভাস লো-টপ"), C("Running Mesh Sneakers", "রানিং মেশ স্নিকার্স"), C("Pastel Street Sneakers", "প্যাস্টেল স্ট্রিট স্নিকার্স")],
    colors: [C("White", "সাদা"), C("Black", "কালো"), C("Pastel", "প্যাস্টেল")], sizes: ["39", "40", "41", "42", "43", "44"], variants: "size", price: [1490, 4490], weight: 0.8,
    specs: [["Upper", "Canvas / mesh"], ["Sole", "Rubber"], ["Closure", "Lace-up"]],
    care: "Spot clean with a soft brush; air dry.",
    blurb: "Light, cushioned and ready for a walk around Hatirjheel.",
  },
]
