export const KEYWORD_CATEGORIES: Record<
  string,
  { color: string; keywords: string[] }
> = {
  "AI Companies & Models": {
    color: "#303f6e", // navy blue
    keywords: [
      "OpenAI",
      "Anthropic",
      "Google AI",
      "Microsoft AI",
      "Meta AI",
      "xAI",
      "Mistral",
      "Open Source Models",
      "ByteDance AI",
      "Nvidia",
    ],
  },
  "Technical Concepts": {
    color: "#2E7D6B", // teal
    keywords: [
      "AI Agents",
      "LLMs",
      "Reinforcement Learning",
      "Multimodal AI",
      "Code Generation",
      "Video Generation",
      "RAG",
      "Fine-tuning",
      "Reasoning",
      "AI Benchmarks",
    ],
  },
  Applications: {
    color: "#E3B23C", // warm gold
    keywords: [
      "Enterprise AI",
      "Healthcare AI",
      "Education AI",
      "AI Search",
      "Cybersecurity AI",
      "Robotics",
      "AI Infrastructure",
      "Creative AI",
    ],
  },
  "Industry & Society": {
    color: "#C05746", // muted red
    keywords: [
      "AI Safety",
      "AI Ethics",
      "AI Regulation",
      "Job Market",
      "AI Startups",
      "AI Research",
      "Accessibility",
    ],
  },
};

export function getCategoryColor(keyword: string): string {
  for (const [, data] of Object.entries(KEYWORD_CATEGORIES)) {
    if (data.keywords.includes(keyword)) {
      return data.color;
    }
  }
  return "#6b7280"; // gray fallback
}

export function getCategoryName(keyword: string): string {
  for (const [category, data] of Object.entries(KEYWORD_CATEGORIES)) {
    if (data.keywords.includes(keyword)) {
      return category;
    }
  }
  return "Other";
}
