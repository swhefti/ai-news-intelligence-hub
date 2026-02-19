#!/usr/bin/env python3
"""
Test script for the keyword taxonomy classifier.
"""

from taxonomy import classify_text

test_articles = [
    "OpenAI releases GPT-5 with improved reasoning capabilities",
    "Google DeepMind announces Gemini 3 with multimodal features",
    "AI agents are transforming enterprise workflows",
    "New study shows AI job displacement concerns in healthcare sector",
    "Anthropic raises $500M to advance Claude safety research",
]

for article in test_articles:
    keywords = classify_text(article)
    print(f"Article: {article[:50]}...")
    print(f"Keywords: {keywords}\n")
