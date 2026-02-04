import sys
import os
from pathlib import Path
from unittest.mock import MagicMock, patch

# Add backend to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(backend_dir))

# Mock External Dependencies ------------------------------------------

# Helper to mock a module and its submodules
def mock_module(module_name):
    mock = MagicMock()
    sys.modules[module_name] = mock
    return mock

# 1. Mock LlamaIndex and submodules
mock_li = mock_module("llama_index")
mock_li_core = mock_module("llama_index.core")

mock_li_core_qe = mock_module("llama_index.core.query_engine")
mock_li_core_tools = mock_module("llama_index.core.tools")
mock_li_core_llms = mock_module("llama_index.core.llms")

mock_li_vs = mock_module("llama_index.vector_stores")
mock_li_vs_chroma = mock_module("llama_index.vector_stores.chroma")

mock_li_emb = mock_module("llama_index.embeddings")
mock_li_emb_hf = mock_module("llama_index.embeddings.huggingface")

mock_li_llms = mock_module("llama_index.llms")
mock_li_llms_openai = mock_module("llama_index.llms.openai")

mock_li_agent = mock_module("llama_index.agent")
mock_li_agent_openai = mock_module("llama_index.agent.openai")


# 2. Mock ChromaDB
mock_chromadb = mock_module("chromadb")
mock_chromadb_config = mock_module("chromadb.config")

# ---------------------------------------------------------------------

try:
    from app.services.qa_service import QAService
except Exception as e:
    print(f"Import failed: {e}")
    sys.modules["app.database"] = MagicMock()
    sys.modules["app.models.qa"] = MagicMock()
    from app.services.qa_service import QAService

def test_workflow():
    print("Testing QA Workflow Structure...")
    
    with patch("app.services.qa_service.VectorDBService") as MockVectorDB:
        mock_vdb_instance = MockVectorDB.return_value
        mock_query_engine = MagicMock()
        mock_vdb_instance.get_citation_query_engine.return_value = mock_query_engine
        
        service = QAService()
        print("✅ QAService initialized")
        
        with patch("app.services.qa_service.OpenAIAgent") as MockAgentClass:
            mock_agent_instance = MockAgentClass.from_tools.return_value
            
            mock_response = MagicMock()
            mock_response.__str__.return_value = "This is a mock answer."
            
            mock_node = MagicMock()
            mock_node.node.get_content.return_value = "Source content..."
            mock_node.score = 0.95
            mock_node.metadata = {"file_name": "test.pdf", "page_label": "p.1"}
            
            mock_response.source_nodes = [mock_node]
            
            from unittest.mock import AsyncMock
            mock_agent_instance.achat = AsyncMock(return_value=mock_response)
            
            print("Running get_ai_answer...")
            import asyncio
            result = asyncio.run(service.get_ai_answer(
                question="Test Question",
                course_id="test-course",
                history=[{"role": "user", "content": "Previous msg"}]
            ))
            
            print(f"Result: {result}")
            assert result["answer"] == "This is a mock answer."
            assert len(result["sources"]) == 1
            assert result["sources"][0]["file_name"] == "test.pdf"
            
            print("✅ Workflow test passed!")

if __name__ == "__main__":
    try:
        test_workflow()
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
