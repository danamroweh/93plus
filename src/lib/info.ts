/**
 * 93+ · Info pages
 *
 * Shipping, returns, size guide and the legal pair. Plain data so copy
 * changes never touch layout. Returns policy is still a draft — Hadi to finalise.
 */

export type InfoBlock =
  | { kind: "text"; heading?: string; body: string }
  | { kind: "table"; heading?: string; head: string[]; rows: string[][]; note?: string };

export type InfoPage = {
  slug: string;
  title: string;
  /** One line under the title, in the brand voice. */
  lede: string;
  blocks: InfoBlock[];
};

export const INFO_PAGES: InfoPage[] = [
  {
    slug: "about",
    title: "About us",
    lede: "A football shirt shop from Lebanon, for the people who stay past ninety.",
    blocks: [
      {
        kind: "text",
        heading: "The name",
        body: "93+ is the clock after the ninetieth minute — stoppage time, when matches actually get decided. That's who we're for: the ones who never leave early.",
      },
      {
        kind: "text",
        heading: "What we sell",
        body: "This season's kits and the retro classics from the clubs people ask us for most — Real Madrid, Barcelona, Liverpool, Juventus, Bayern Munich, AC Milan, Arsenal and Inter. Every shirt comes as a full set, shirt and shorts, in Fan or Player version, printed with any name and number you want. Plus keychains, mugs and pillows.",
      },
      {
        kind: "text",
        heading: "How it works",
        body: "Order here in a minute. Pay cash at the door, or by Whish or OMT. A real person confirms every order on WhatsApp, and it reaches you in 4–5 days anywhere in Lebanon — never more than a week. Free delivery on orders over $50.",
      },
      {
        kind: "text",
        heading: "Not right?",
        body: "Wrong size, faulty, or not what you ordered: we swap it or refund you within 30 days.",
      },
      {
        kind: "text",
        heading: "Talk to us",
        body: "WhatsApp +961 71 312 076, or @ninety_three_plus on Instagram. We answer.",
      },
    ],
  },
  {
    slug: "shipping",
    title: "Delivery",
    lede: "Lebanon only. Door to door.",
    blocks: [
      {
        kind: "table",
        head: ["Where", "Time", "Cost"],
        rows: [
          ["Beirut", "4–5 days", "$4"],
          ["Rest of Lebanon", "4–5 days", "$5"],
        ],
        note: "Free delivery on every order over $50. Never more than 7 days from the day you order.",
      },
      {
        kind: "text",
        heading: "Paying",
        body: "Cash at the door, or Whish / OMT. Paying by transfer? Our number and your order code are on screen the moment you order. We ship as soon as the transfer lands, and confirm on WhatsApp.",
      },
      {
        kind: "text",
        heading: "Personalised shirts",
        body: "Name and number printing is included in the 4–5 days.",
      },
      {
        kind: "text",
        heading: "Questions",
        body: "WhatsApp +961 71 312 076 — fastest way to reach us.",
      },
    ],
  },
  {
    slug: "returns",
    title: "Returns",
    lede: "Thirty days, for a real reason.",
    blocks: [
      {
        kind: "text",
        heading: "We take it back if",
        body: "It arrived faulty or damaged, we sent the wrong item, or the size is wrong — unworn, unwashed, tags on. Message us within 30 days of delivery.",
      },
      {
        kind: "text",
        heading: "We don't if",
        body: "You've changed your mind, or it's been worn or washed. Shirts printed with a name and number come back only if they're faulty or we got the print wrong.",
      },
      {
        kind: "text",
        heading: "How",
        body: "WhatsApp +961 71 312 076 with your order and a photo. We swap it or refund you — your choice.",
      },
    ],
  },
  {
    slug: "size-guide",
    title: "Size guide",
    lede: "Measure a shirt you already love. Match it here.",
    blocks: [
      {
        kind: "table",
        heading: "Fan version",
        head: ["Size", "Chest (cm)", "Length (cm)"],
        rows: [
          ["S", "96", "70"],
          ["M", "102", "72"],
          ["L", "108", "74"],
          ["XL", "114", "76"],
          ["XXL", "120", "78"],
        ],
        note: "Measured flat across the chest, doubled. Regular fit. Every shirt is a full set — the shorts come in the same size.",
      },
      {
        kind: "text",
        heading: "Player version",
        body: "Cut the way it's worn on the pitch — slim through the body, shorter sleeve. Between sizes, or prefer it loose? Go one up.",
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy",
    lede: "We keep what we need to get you the shirt. Nothing else.",
    blocks: [
      {
        kind: "text",
        heading: "What we collect",
        body: "Your name, delivery address, email and phone — only to fulfil and track your order. Payment details are handled by our payment provider and never touch our servers.",
      },
      {
        kind: "text",
        heading: "Cookies",
        body: "One cookie remembers your cart. No ad trackers.",
      },
      {
        kind: "text",
        heading: "Your data",
        body: "Ask us to see or delete anything we hold about you and it's done within 30 days.",
      },
    ],
  },
  {
    slug: "terms",
    title: "Terms",
    lede: "The short version of the small print.",
    blocks: [
      {
        kind: "text",
        heading: "Orders",
        body: "An order is confirmed when payment clears. If something sells out between your click and our stockroom, we refund in full, immediately.",
      },
      {
        kind: "text",
        heading: "Prices",
        body: "All prices are in USD. We deliver within Lebanon only.",
      },
      {
        kind: "text",
        heading: "Names and marks",
        body: "93+ is an independent shop. Club and player names describe the products; we're not affiliated with any club, player or league.",
      },
    ],
  },
];

export const getInfoPage = (slug: string) =>
  INFO_PAGES.find((p) => p.slug === slug) ?? null;
