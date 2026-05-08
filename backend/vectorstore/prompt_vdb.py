# prompt_vdb.py
import os
import sys
from vector_store import IncidentVectorStore
import logging

logging.basicConfig(level=logging.WARNING)

def print_separator():
    print("=" * 70)

def format_result(idx: int, res) -> None:
    inc = res.incident
    print(f"\n📌 Result #{idx} | Similarity: {res.similarity:.3f}")
    print(f"   🆔 ID: {inc.id}")
    print(f"   📝 Title: {inc.title}")
    print(f"   🔧 Service: {inc.service} | ⚠️ Severity: {inc.severity}")
    print(f"   📄 Description: {inc.description}")
    print(f"   ✅ Resolution: {inc.resolution}")
    print(f"   🔍 RCA Summary: {inc.rca_summary}")
    print(f"   🏷️  Tags: {', '.join(inc.tags)}")

def main():
    print("🔍 Incident Knowledge Base Prompt Interface")
    print("Type a natural language query to search historical incidents.")
    print("Commands: 'quit' to exit, 'k=5' to change result count\n")
    
    db_path = "./chroma_incidents"
    if not os.path.exists(db_path):
        print(f"❌ Vector DB not found at '{db_path}'. Run ingestion first.")
        sys.exit(1)

    vdb = IncidentVectorStore(persist_directory=db_path)
    k = 3

    while True:
        try:
            query = input("📝 Query: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n👋 Exiting. Goodbye!")
            break

        if not query:
            continue
        if query.lower() in ['quit', 'exit', 'q']:
            print("👋 Exiting. Goodbye!")
            break

        # Allow dynamic k adjustment
        if query.startswith("k="):
            try:
                k = int(query.split("=")[1])
                print(f"🔢 Result count set to k={k}")
                continue
            except ValueError:
                print("⚠️ Invalid k value. Use format: k=5")
                continue

        try:
            print("\n⏳ Searching knowledge base...")
            results = vdb.search(query, k=k)
            
            if not results:
                print("⚠️ No matching incidents found. Try rephrasing or adjusting keywords.\n")
                continue

            print_separator()
            print(f"✅ Found {len(results)} similar incident(s):")
            print_separator()
            for i, res in enumerate(results, 1):
                format_result(i, res)
            print_separator()
            print()
        except Exception as e:
            print(f"❌ Search failed: {e}\n")

if __name__ == "__main__":
    main()