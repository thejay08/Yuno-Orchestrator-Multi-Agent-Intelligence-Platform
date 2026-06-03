import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Workflow, Plus, Trash2, ArrowRight, Layers, FileText } from 'lucide-react';

export default function Workflows() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchWorkflows = async () => {
    try {
      const res = await fetch('/api/workflows');
      if (res.ok) {
        setWorkflows(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to permanently clear this Pipeline Canvas connection matrix?")) {
      try {
        const response = await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
        if (response.ok) {
          fetchWorkflows();
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleExecute = async (id) => {
    // Initiate Execution Run trace
    try {
      const response = await fetch(`/api/executions/${id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: { text: "Search modern artificial intelligence benchmarks using our researcher agent block and edit details using summarizer." }
        })
      });

      if (response.ok) {
        const data = await response.json();
        navigate(`/monitor/${data.id}`);
      } else {
        alert("Failed to queue pipeline run trace.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 border-2 border-black border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans">
      <div className="flex justify-between items-center bg-white p-6 border border-gray-200">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-900">Pipeline Canvas Matrix</h2>
          <p className="text-xs text-gray-400 mt-1">Design dynamic state graphs, sequential dependencies, routing conditionals, and corrective feedback cycles.</p>
        </div>
        <NavLink 
          to="/workflows/new" 
          className="px-4 py-2 bg-black hover:bg-gray-800 text-white font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5 cursor-pointer transition duration-150"
        >
          <Plus className="w-3.5 h-3.5" /> Initialize New Pipeline Canvas
        </NavLink>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {workflows.map(wf => {
          const nodesCount = wf.graph_definition?.nodes?.length || 0;
          const edgesCount = wf.graph_definition?.edges?.length || 0;

          return (
            <div key={wf.id} className="bg-white border border-gray-200 p-6 flex flex-col justify-between hover:border-black transition duration-150">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Workflow className="w-4 h-4 text-gray-750" />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400">{wf.is_template ? 'PRESET TEMPLATE' : 'DEVELOPER CANVAS'}</span>
                  </div>
                  <button
                    onClick={() => handleDelete(wf.id)}
                    className="text-gray-400 hover:text-black transition cursor-pointer"
                    title="Delete workflow"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-tight">{wf.name}</h3>
                  <p className="text-xs text-gray-500 font-medium leading-relaxed">{wf.description || 'No summary parameters defined.'}</p>
                </div>

                <div className="flex gap-4 border-t border-gray-100 pt-3 text-[10px] uppercase font-bold font-mono text-gray-400">
                  <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> {nodesCount} Node Blocks</span>
                  <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {edgesCount} Routing Wires</span>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
                <NavLink
                  to={`/workflows/${wf.id}`}
                  className="w-full py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-150 text-center text-[10px] font-bold uppercase tracking-widest font-mono text-gray-700 cursor-pointer block"
                >
                  Configure Canvas
                </NavLink>
                <button
                  onClick={() => handleExecute(wf.id)}
                  className="w-full py-2.5 bg-black hover:bg-gray-800 text-white text-center text-[10px] font-bold uppercase tracking-widest font-mono cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Launch Run <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
