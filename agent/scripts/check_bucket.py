import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from tomo.tools.supabase_client import get_supabase

sb = get_supabase()
print(sb.storage.get_bucket("tomo-docs"))