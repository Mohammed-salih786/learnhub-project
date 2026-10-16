export const categories = [
  { id: "design", name: "Design", description: "UX, product thinking, and visual storytelling." },
  { id: "development", name: "Development", description: "Frontend, backend, and software craft." },
  { id: "marketing", name: "Marketing", description: "Growth, content, and performance strategy." },
  { id: "business", name: "Business", description: "Operations, leadership, and career systems." }
] as const;

export const courses = [
  {
    id: "crs-design-systems",
    slug: "design-systems-for-product-teams",
    title: "Design Systems for Product Teams",
    category: "Design",
    instructor: "Asha Menon",
    priceCents: 29900,
    description: "Build scalable UI systems, design tokens, and product review rituals for modern teams.",
    shortDescription: "Design systems, tokens, and UI patterns with product context.",
    lessons: 12,
    level: "Beginner",
    rating: 4.8,
    isPublished: true
  },
  {
    id: "crs-web-dev",
    slug: "nextjs-bootcamp",
    title: "Next.js Bootcamp",
    category: "Development",
    instructor: "Rohan Iyer",
    priceCents: 39900,
    description: "Build production-ready interfaces using React, Next.js, TypeScript, and API design.",
    shortDescription: "Frontend architecture and shipping real web applications.",
    lessons: 16,
    level: "Intermediate",
    rating: 4.9,
    isPublished: true
  },
  {
    id: "crs-growth-hacks",
    slug: "growth-playbooks-for-saas",
    title: "Growth Playbooks for SaaS",
    category: "Marketing",
    instructor: "Mira Shah",
    priceCents: 24900,
    description: "Learn lifecycle messaging, funnel design, and retention planning that works in India.",
    shortDescription: "Acquisition, conversion, and retention systems for growth teams.",
    lessons: 10,
    level: "Beginner",
    rating: 4.7,
    isPublished: true
  },
  {
    id: "crs-career-sprint",
    slug: "career-sprint-for-founders",
    title: "Career Sprint for Founders",
    category: "Business",
    instructor: "Nikhil Rao",
    priceCents: 21900,
    description: "Develop strategic decision frameworks, stakeholder communication, and execution habits.",
    shortDescription: "Strategy and operating rhythm for early-stage operators.",
    lessons: 8,
    level: "Intermediate",
    rating: 4.6,
    isPublished: true
  }
] as const;

export const adminOverview = {
  totalSubscribers: 8200,
  activeInstructors: 214,
  pendingReviews: 18,
  revenueCents: 360000,
  conversionRate: 4.8,
  churnRate: 2.1
};

export const moderationQueue = [
  {
    id: "mod-1",
    reviewer: "Ananya Shah",
    courseTitle: "AI Workflow Playbooks",
    reason: "The course claims guaranteed outcomes without substantiating evidence.",
    severity: "high",
    status: "pending"
  },
  {
    id: "mod-2",
    reviewer: "Rahul Nair",
    courseTitle: "Beginner Video Editing",
    reason: "Pricing and refund policy copy conflicts with the platform policy.",
    severity: "medium",
    status: "pending"
  }
];

export const payoutQueue = [
  { instructor: "Maya Singh", amountCents: 2450000, status: "Pending" },
  { instructor: "Arjun Verma", amountCents: 1820000, status: "Scheduled" },
  { instructor: "Nisha Rao", amountCents: 1275000, status: "Processing" }
];

export const plans = [
  { key: "trial", label: "7-day free trial", priceCents: 0 },
  { key: "monthly", label: "Monthly", priceCents: 14900 },
  { key: "yearly", label: "Yearly", priceCents: 99900 }
];

export const lessonLibrary = {
  "crs-design-systems": [
    { id: "les-1", title: "Foundations of product design", durationMinutes: 18, isPreview: true },
    { id: "les-2", title: "Design tokens and decisions", durationMinutes: 24, isPreview: false },
    { id: "les-3", title: "System thinking in UI", durationMinutes: 26, isPreview: false }
  ],
  "crs-web-dev": [
    { id: "les-4", title: "App Router fundamentals", durationMinutes: 20, isPreview: true },
    { id: "les-5", title: "Server and client boundaries", durationMinutes: 22, isPreview: false },
    { id: "les-6", title: "Shipping production-grade Next.js", durationMinutes: 28, isPreview: false }
  ],
  "crs-growth-hacks": [
    { id: "les-7", title: "Retention loops that work", durationMinutes: 19, isPreview: true },
    { id: "les-8", title: "Messaging for B2B SaaS", durationMinutes: 25, isPreview: false },
    { id: "les-9", title: "Lifecycle experiments", durationMinutes: 21, isPreview: false }
  ],
  "crs-career-sprint": [
    { id: "les-10", title: "Operating cadence", durationMinutes: 17, isPreview: true },
    { id: "les-11", title: "Leadership communication", durationMinutes: 24, isPreview: false },
    { id: "les-12", title: "Execution frameworks", durationMinutes: 26, isPreview: false }
  ]
} as const;

export const analytics = {
  trialToPaidConversion: 4.8,
  monthlyChurn: 2.1,
  courseCompletion: 78,
  supportBacklog: 34,
  revenueMix: {
    monthly: 180000,
    yearly: 120000,
    instructorPayouts: 70000
  }
} as const;

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(cents / 100);
}
