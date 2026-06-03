import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, NavLink } from 'react-router-dom';
import { 
  ReactFlow, 
  MiniMap, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState, 
  addEdge 
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Bot, Save, Play, ChevronLeft, Layers, Database } from 'lucide-react';
import AgentNode from '../components/AgentNode';

const nodeTypes = {
  customNode: AgentNode,
};

export default function WorkflowBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = id && id !== 'new';

  const [agents, setAgents] = useState([]);
  const [workflowName, setWorkflowName] = useState('New Orchestration Pipeline');
  const [workflowDesc, setWorkflowDesc] = useState('Draft custom sequential routing schemas.');
  const [isTemplate, setIsTemplate] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Fetch agents to show in left container selection
  useEffect(() => {
    fetch('/api/agents')
      .then(res => res.json())
      .then(data => setAgents(data))
      .catch(err => console.error(err));

    if (isEdit) {
      fetch(`/api/workflows/${id}`)
        .then(res => res.json())
        .then(data => {
          setWorkflowName(data.name);
          setWorkflowDesc(data.description);
          setIsTemplate(data.is_template);
          
          // Re-map nodes and edges for React Flow schema
          const mappedNodes = (data.graph_definition?.nodes || []).map((n, idx) => ({
            id: n.id,
            type: 'customNode',
            position: n.position || { x: 100 + idx * 220, y: 150 },
            data: { 
              label: n.label, 
              type: n.type, 
              role: n.type === 'agent' ? 'Cognitive Processor' : 'Decision Rule', 
              config: n.config 
            }
          }));

          const mappedEdges = (data.graph_definition?.edges || []).map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.conditionLabel || 'always'
          }));

          setNodes(mappedNodes);
          setEdges(mappedEdges);
        })
        .catch(err => console.error(err));
    } else {
      // Setup typical starter nodes
      setNodes([
        {
          id: 'start',
          type: 'customNode',
          position: { x: 50, y: 150 },
          data: { label: 'Client Input Task', type: 'input', role: 'Input Trigger' }
        },
        {
          id: 'end',
          type: 'customNode',
          position: { x: 600, y: 150 },
          data: { label: 'Deliver Draft Output', type: 'output', role: 'Result Output' }
        }
      ]);
    }
  }, [id, isEdit]);

  const onConnect = useCallback((params) => {
    const updatedParams = { ...params, label: 'always' };
    setEdges((eds) => addEdge(updatedParams, eds));
  }, [setEdges]);

  // Drag and drop / Trigger adding an agent node block to the canvas list
  const handleAddAgentNode = (agent) => {
    const newId = `node-${Math.random().toString(36).substring(7)}`;
    const newNode = {
      id: newId,
      type: 'customNode',
      position: { x: 250, y: 180 },
      data: { 
        label: agent.name, 
        type: 'agent', 
        agentId: agent.id,
        role: agent.role 
      }
    };
    setNodes(prev => [...prev, newNode]);
  };

  const handleAddConditionNode = () => {
    const newId = `node-condition-${Math.random().toString(36).substring(7)}`;
    const newNode = {
      id: newId,
      type: 'customNode',
      position: { x: 350, y: 150 },
      data: { 
        label: 'Compliance Branch Check', 
        type: 'condition', 
        role: 'Gateway Rule',
        config: {
          conditionExpression: 'compliant === true',
          yesNodeId: 'end',
          noNodeId: 'start'
        }
      }
    };
    setNodes(prev => [...prev, newNode]);
  };

  const handleSaveWorkspace = async () => {
    const graphNodes = nodes.map(n => ({
      id: n.id,
      type: n.data.type,
      label: n.data.label,
      agentId: n.data.agentId,
      config: n.data.config,
      position: n.position
    }));

    const graphEdges = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      conditionLabel: typeof e.label === 'string' ? e.label : 'always'
    }));

    const payload = {
      id: isEdit ? id : `wf-${Math.random().toString(36).substring(7)}`,
      name: workflowName,
      description: workflowDesc,
      is_template: isTemplate,
      graph_definition: {
        nodes: graphNodes,
        edges: graphEdges
      }
    };

    try {
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        navigate('/workflows');
      } else {
        alert("Commit pipeline failed.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-[750px] flex flex-col font-sans -mx-10 -my-12">
      {/* Visual Canvas Toolbar top block */}
      <div className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <NavLink to="/workflows" className="p-2 border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-700">
            <ChevronLeft className="w-4 h-4" />
          </NavLink>
          <div>
            <input 
              type="text" 
              value={workflowName} 
              onChange={e => setWorkflowName(e.target.value)}
              className="bg-transparent text-sm font-bold text-gray-900 outline-none border-b border-transparent focus:border-black uppercase tracking-tight py-0.5"
            />
            <p className="text-[10px] text-gray-400 font-semibold tracking-wide uppercase mt-0.5">Pipeline Graph Builder Canvas</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveWorkspace}
            className="px-4 py-2 bg-black hover:bg-gray-800 text-white font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5 cursor-pointer transition duration-150"
          >
            <Save className="w-3.5 h-3.5" /> Commit Schema
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Drag/Add Blocks list */}
        <aside className="w-72 bg-white border-r border-gray-200 flex flex-col justify-between shrink-0 overflow-y-auto">
          <div className="p-6 space-y-6">
            <div className="space-y-1">
              <span className="inline-block px-1.5 py-0.2 bg-gray-100 text-[8px] font-bold uppercase tracking-widest text-zinc-500 rounded">Available Blocks</span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900">Draggable Cognitive Blocks</h3>
              <p className="text-[10px] text-gray-400 font-medium leading-relaxed">Click any block below to spawn it into your design canvas workspace.</p>
            </div>

            <div className="space-y-2 pt-2 border-t border-gray-100">
              <button
                onClick={handleAddConditionNode}
                className="w-full p-4 border border-zinc-200 hover:border-black text-left cursor-pointer transition bg-zinc-50"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-900">Routing Decision</p>
                </div>
                <p className="text-[9px] text-gray-400 font-medium leading-tight">Branch outputs using condition keyword parameters.</p>
              </button>

              {agents.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => handleAddAgentNode(agent)}
                  className="w-full p-4 border border-gray-200 hover:border-black text-left cursor-pointer transition bg-white block"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Bot className="w-3.5 h-3.5 text-gray-650" />
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-900">{agent.name}</p>
                  </div>
                  <p className="text-[9px] text-gray-450 font-medium leading-tight uppercase">{agent.role}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 border-t border-gray-100 bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
            <Database className="w-4 h-4 text-zinc-400" /> schema: live trace active
          </div>
        </aside>

        {/* Right Side: Flow Canvas viewport */}
        <div className="flex-1 bg-gray-50 h-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
          >
            <Controls style={{ background: '#FAFBFB', border: '1px solid #E5E7EB', borderRadius: 0 }} />
            <MiniMap style={{ background: '#FAFBFB', border: '1px solid #E5E7EB', borderRadius: 0 }} />
            <Background gap={16} size={0.8} color="#D1D5DB" />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
