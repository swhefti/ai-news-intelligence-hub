"""
Keyword taxonomy for AI News Intelligence Hub.
Each keyword has a list of synonyms/variations that should map to it.
During classification, if any synonym is found, the article gets tagged with the main keyword.
"""

TAXONOMY = {
    # === AI Companies & Models ===
    "OpenAI": [
        "openai", "chatgpt", "gpt-4", "gpt-5", "gpt-4o", "gpt-5.2", "gpt-5.3",
        "sam altman", "codex", "dall-e", "dalle", "sora", "openai api"
    ],
    "Anthropic": [
        "anthropic", "claude", "claude 3", "claude 4", "claude sonnet",
        "claude opus", "claude haiku", "dario amodei", "constitutional ai"
    ],
    "Google AI": [
        "google ai", "gemini", "deepmind", "google deepmind", "bard",
        "gemini pro", "gemini ultra", "google brain", "tensorflow"
    ],
    "Microsoft AI": [
        "microsoft ai", "copilot", "github copilot", "azure ai", "azure openai",
        "bing ai", "microsoft copilot", "kevin scott"
    ],
    "Meta AI": [
        "meta ai", "llama", "llama 2", "llama 3", "llama 4", "yann lecun",
        "meta llama", "facebook ai"
    ],
    "xAI": [
        "xai", "grok", "grok-2", "grok-3", "elon musk ai", "x.ai"
    ],
    "Mistral": [
        "mistral", "mistral ai", "mixtral", "mistral large", "le chat"
    ],
    "Open Source Models": [
        "open source llm", "hugging face", "huggingface", "ollama", "open weights",
        "stability ai", "stable diffusion", "falcon", "mpt", "open source ai"
    ],
    "ByteDance AI": [
        "bytedance", "doubao", "seedance", "bytedance ai"
    ],
    "Nvidia": [
        "nvidia", "cuda", "nvidia ai", "jensen huang", "h100", "a100",
        "nvidia gpu", "tensorrt", "nvidia inference"
    ],

    # === Technical Concepts ===
    "AI Agents": [
        "ai agent", "ai agents", "agentic", "agentic ai", "autonomous agent",
        "agent framework", "multi-agent", "agent loop", "tool use"
    ],
    "LLMs": [
        "llm", "llms", "large language model", "large language models",
        "language model", "foundation model", "foundation models"
    ],
    "Reinforcement Learning": [
        "reinforcement learning", "rl", "rlhf", "ppo", "dpo", "reward model",
        "policy optimization", "deep reinforcement learning"
    ],
    "Multimodal AI": [
        "multimodal", "vision language", "vlm", "image understanding",
        "visual language model", "multimodal llm", "image-text"
    ],
    "Code Generation": [
        "code generation", "ai coding", "code assistant", "coding assistant",
        "vibe coding", "ai programmer", "code completion", "code synthesis"
    ],
    "Video Generation": [
        "video generation", "ai video", "text to video", "video ai",
        "video synthesis", "ai filmmaking", "video model"
    ],
    "RAG": [
        "rag", "retrieval augmented", "retrieval-augmented generation",
        "vector search", "semantic search", "embedding search"
    ],
    "Fine-tuning": [
        "fine-tuning", "fine tuning", "finetuning", "lora", "qlora",
        "adapter", "peft", "instruction tuning"
    ],
    "Reasoning": [
        "reasoning", "chain of thought", "chain-of-thought", "cot",
        "o1", "o3", "o4", "deep think", "step by step reasoning"
    ],
    "AI Benchmarks": [
        "benchmark", "benchmarking", "evaluation", "eval", "mmlu",
        "leaderboard", "ai benchmark", "model evaluation"
    ],

    # === Applications ===
    "Enterprise AI": [
        "enterprise ai", "enterprise", "business ai", "corporate ai",
        "ai transformation", "ai adoption", "ai implementation"
    ],
    "Healthcare AI": [
        "healthcare ai", "medical ai", "health ai", "clinical ai",
        "diagnosis ai", "drug discovery", "biomedical ai", "health tech"
    ],
    "Education AI": [
        "education ai", "edtech", "ai tutor", "learning ai", "ai education",
        "ai teaching", "educational ai", "language learning"
    ],
    "AI Search": [
        "ai search", "searchgpt", "perplexity", "search ai", "ai-powered search",
        "conversational search", "semantic search engine"
    ],
    "Cybersecurity AI": [
        "cybersecurity", "ai security", "security ai", "threat detection",
        "malware", "cyber attack", "hacking", "infosec ai"
    ],
    "Robotics": [
        "robotics", "robot", "humanoid", "robotic", "manipulation",
        "embodied ai", "robot learning", "autonomous robot"
    ],
    "AI Infrastructure": [
        "ai infrastructure", "data center", "ai chip", "ai hardware",
        "compute", "gpu cluster", "inference chip", "ai server", "tpu"
    ],
    "Creative AI": [
        "ai art", "generative art", "ai music", "ai creative", "ai design",
        "creative ai", "ai animation", "ai filmmaking"
    ],

    # === Industry & Society ===
    "AI Safety": [
        "ai safety", "alignment", "ai alignment", "existential risk",
        "x-risk", "ai risk", "safe ai", "safety research"
    ],
    "AI Ethics": [
        "ai ethics", "bias", "fairness", "responsible ai", "ai bias",
        "ethical ai", "discrimination", "ai fairness"
    ],
    "AI Regulation": [
        "ai regulation", "ai law", "eu ai act", "ai governance",
        "ai policy", "regulate ai", "ai legislation", "government ai"
    ],
    "Job Market": [
        "job loss", "job market", "automation", "ai jobs", "workforce",
        "employment", "job displacement", "future of work", "ai replacing"
    ],
    "AI Startups": [
        "ai startup", "funding", "investment", "venture capital", "vc",
        "seed round", "series a", "ai investment", "startup", "ipo"
    ],
    "AI Research": [
        "research", "paper", "arxiv", "study", "researchers",
        "scientific", "academic", "breakthrough", "discovery"
    ],
    "Accessibility": [
        "accessibility", "accessible", "disability", "deaf", "blind",
        "assistive", "inclusive ai", "a11y"
    ],
}


def get_all_keywords() -> list[str]:
    """Return list of all main keywords."""
    return list(TAXONOMY.keys())


def get_synonyms(keyword: str) -> list[str]:
    """Return list of synonyms for a keyword."""
    return TAXONOMY.get(keyword, [])


def classify_text(text: str) -> list[str]:
    """
    Simple keyword matching classification.
    Returns list of keywords found in the text.
    """
    text_lower = text.lower()
    matched_keywords = []

    for keyword, synonyms in TAXONOMY.items():
        for synonym in synonyms:
            if synonym.lower() in text_lower:
                matched_keywords.append(keyword)
                break  # Only add each keyword once

    return matched_keywords
