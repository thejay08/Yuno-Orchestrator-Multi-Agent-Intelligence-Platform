import React, { useEffect, useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { History, Search, ArrowUpRight, Activity, Cpu } from 'lucide-react';

export default function Messages() {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/executions')
      .then(res => res.json())
      .then(data => {
        setExecutions(data || []);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const filteredExecutions = executions.filter(exec => {
    if (!filterText) return true;
    return exec.id.toLowerCase().includes(filterText.toLowerCase()) || 
           (exec.workflow_id || '').toLowerCase().includes(filterText.toLowerCase());
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 font-sans">
        <div className="h-6 w-6 border-2 border-black border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans">
      <div className="bg-white p-6 border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-900">Execution Runs Session Archive</h2>
          <p className="text-xs text-gray-400 mt-1">Audit complete historic logs, state variables outputs, and live streams.</p>
        </div>
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Search run hash index..."
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 text-xs font-semibold uppercase tracking-tight bg-white outline-none focus:border-black transition"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
        </div>
      </div>

      <div className="bg-white border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F9FAFB] border-b border-gray-150 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <th className="py-4 px-6">Run identifier</th>
              <th className="py-4 px-6">Workflow ID</th>
              <th className="py-4 px-6">Run status</th>
              <th className="py-4 px-6">Started timestamp</th>
              <th className="py-4 px-6 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-150 text-xs font-sans">
            {filteredExecutions.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-gray-400 uppercase font-black tracking-widest text-[10px]">
                  No pipeline execution histories logged.
                </td>
              </tr>
            ) : (
              filteredExecutions.map(exec => (
                <tr key={exec.id} className="hover:bg-[#FCFDFD] transition">
                  <td className="py-4 px-6 font-bold text-gray-900 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-gray-500" />
                    <span className="font-mono">{exec.id}</span>
                  </td>
                  <td className="py-4 px-6 text-zinc-500 font-mono text-[10px] uppercase font-bold">{exec.workflow_id}</td>
                  <td className="py-4 px-6">
                    <span className={`inline-block px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase ${
                      exec.status === 'completed' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' 
                        : exec.status === 'failed' 
                          ? 'bg-rose-50 text-rose-700 border border-rose-250' 
                          : 'bg-sky-50 text-sky-700 border border-sky-250 animate-pulse'
                    }`}>
                      {exec.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-gray-450 font-medium select-none">
                    {new Date(exec.started_at).toLocaleString()}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <NavLink
                      to={`/monitor/${exec.id}`}
                      className="px-3 py-1.5 border border-zinc-200 hover:border-black text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 justify-center ml-auto w-fit cursor-pointer transition bg-white text-zinc-800"
                    >
                      Audit trace <ArrowUpRight className="w-3.5 h-3.5" />
                    </NavLink>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
