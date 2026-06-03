/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Workflow, WorkflowNode, WorkflowEdge, Agent } from '../types';
import { 
  GitCommit, 
  HelpCircle, 
  ArrowRight, 
  RefreshCw, 
  Plus, 
  Trash2, 
  Workflow as WorkflowIcon,
  Combine, 
  Compass, 
  CheckCircle,
  FileText,
  MousePointer,
  HelpCircle as HelpIcon,
  Bot
} from 'lucide-react';

interface VisualWorkflowBuilderProps {
  workflows: Workflow[];
  agents: Agent[];
  onSaveWorkflow: (workflow: Workflow) => Promise<void>;
  onDeleteWorkflow: (id: string) => Promise<void>;
}

export default function VisualWorkflowBuilder({ workflows, agents, onSaveWorkflow, onDeleteWorkflow }: VisualWorkflowBuilderProps) {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>(workflows[0]?.id || '');
  const activeWorkflow = workflows.find(w => w.id === selectedWorkflowId);

  const [activeTab, setActiveTab] = useState<'visual' | 'code'>('visual');
  const [isAddingNode, setIsAddingNode] = useState(false);

  // New Node Form states
  const [nodeLabel, setNodeLabel] = useState('');
  const [nodeType, setNodeType] = useState<'agent' | 'condition' | 'input' | 'output'>('agent');
  const [nodeAgentId, setNodeAgentId] = useState(agents[0]?.id || '');
  const [conditionExpr, setConditionExpr] = useState('compliant === true');
  const [yesNode, setYesNode] = useState('');
  const [noNode, setNoNode] = useState('');
  const [loopLimit, setLoopLimit] = useState(3);

  // Connection form states
  const [sourceNodeId, setSourceNodeId] = useState('');
  const [targetNodeId, setTargetNodeId] = useState('');
  const [edgeLabel, setEdgeLabel] = useState('');
  const [isFeedbackLoop, setIsFeedbackLoop] = useState(false);

  const handleTemplateLoad = (templateKey: 'support' | 'seo') => {
    let template: Workflow;
    if (templateKey === 'support') {
      template = {
        id: 'wf-support-qa-loop-' + Date.now().toString(36),
        name: 'Enterprise Support Response Workflow',
        description: 'Collects user issues, drafts a meticulous reply via a Support specialist, passes it to a Senior Compliance Auditor. If QA fails compliance, it triggers feedback loops back to Support for a rewrite.',
        nodes: [
          { id: 'start', type: 'input', label: 'Customer Ticket Input', position: { x: 50, y: 150 } },
          { id: 'support', type: 'agent', label: 'Support Specialist Drafts Reply', agentId: 'agent-support-specialist', position: { x: 250, y: 150 } },
          { id: 'qa', type: 'agent', label: 'Auditor Verifies Compliance', agentId: 'agent-senior-qa', position: { x: 480, y: 150 } },
          { 
            id: 'condition', 
            type: 'condition', 
            label: 'Tone & Quality Compliant?', 
            config: {
              conditionExpression: 'compliant === true',
              yesNodeId: 'publish',
              noNodeId: 'support',
              loopCountLimit: 3
            },
            position: { x: 720, y: 130 } 
          },
          { id: 'publish', type: 'output', label: 'Deliver Approved Support Response', position: { x: 960, y: 150 } }
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'support' },
          { id: 'e2', source: 'support', target: 'qa' },
          { id: 'e3', source: 'qa', target: 'condition' },
          { id: 'e4', source: 'condition', target: 'publish', conditionLabel: 'Approved' },
          { id: 'e5', source: 'condition', target: 'support', conditionLabel: 'QA Failed (Edit Redraft)', isFeedbackLoop: true }
        ],
        createdAt: new Date().toISOString()
      };
    } else {
      template = {
        id: 'wf-seo-generation-loop-' + Date.now().toString(36),
        name: 'SEO Copywriting Feedback Pipeline',
        description: 'Generates promotional copy on any subject, audits and updates formatting / density, auto-corrects using feedback loops if editing grade is insufficient.',
        nodes: [
          { id: 'seo-start', type: 'input', label: 'Draft Topic Theme', position: { x: 50, y: 250 } },
          { id: 'seo-writer', type: 'agent', label: 'SEO Writer Outlines Article', agentId: 'agent-seo-writer', position: { x: 240, y: 250 } },
          { id: 'seo-editor', type: 'agent', label: 'Copyeditor Reviews Density', agentId: 'agent-seo-editor', position: { x: 460, y: 250 } },
          { 
            id: 'seo-condition', 
            type: 'condition', 
            label: 'Density Sufficient?', 
            config: {
              conditionExpression: 'compliant === true',
              yesNodeId: 'seo-publish',
              noNodeId: 'seo-writer',
              loopCountLimit: 2
            },
            position: { x: 680, y: 230 } 
          },
          { id: 'seo-publish', type: 'output', label: 'Publish Final SEO Copy', position: { x: 910, y: 250 } }
        ],
        edges: [
          { id: 'se-1', source: 'seo-start', target: 'seo-writer' },
          { id: 'se-2', source: 'seo-writer', target: 'seo-editor' },
          { id: 'se-3', source: 'seo-editor', target: 'seo-condition' },
          { id: 'se-4', source: 'seo-condition', target: 'seo-publish', conditionLabel: 'Published' },
          { id: 'se-5', source: 'seo-condition', target: 'seo-writer', conditionLabel: 'Needs Enhancements', isFeedbackLoop: true }
        ],
        createdAt: new Date().toISOString()
      };
    }

    onSaveWorkflow(template);
    setSelectedWorkflowId(template.id);
  };

  const handleAddNewNode = () => {
    if (!activeWorkflow) return;
    if (!nodeLabel) {
      alert('Please fill in node labels.');
      return;
    }

    const newNodeId = `node-${Math.random().toString(36).substring(7)}`;
    const newNode: WorkflowNode = {
      id: newNodeId,
      label: nodeLabel,
      type: nodeType,
      position: { x: 400, y: 200 },
      ...(nodeType === 'agent' ? { agentId: nodeAgentId } : {}),
      ...(nodeType === 'condition' ? {
        config: {
          conditionExpression: conditionExpr,
          yesNodeId: yesNode,
          noNodeId: noNode,
          loopCountLimit: loopLimit
        }
      } : {})
    };

    const updatedWorkflow: Workflow = {
      ...activeWorkflow,
      nodes: [...activeWorkflow.nodes, newNode]
    };

    onSaveWorkflow(updatedWorkflow);
    setIsAddingNode(false);
    setNodeLabel('');
  };

  const handleCreateConnection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkflow || !sourceNodeId || !targetNodeId) return;

    const newEdge: WorkflowEdge = {
      id: `edge-${Math.random().toString(36).substring(7)}`,
      source: sourceNodeId,
      target: targetNodeId,
      conditionLabel: edgeLabel || undefined,
      isFeedbackLoop: isFeedbackLoop
    };

    const updatedWorkflow: Workflow = {
      ...activeWorkflow,
      edges: [...activeWorkflow.edges, newEdge]
    };

    onSaveWorkflow(updatedWorkflow);
    setSourceNodeId('');
    setTargetNodeId('');
    setEdgeLabel('');
    setIsFeedbackLoop(false);
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!activeWorkflow) return;
    const updatedWorkflow: Workflow = {
      ...activeWorkflow,
      nodes: activeWorkflow.nodes.filter(n => n.id !== nodeId),
      // Clean edges connected to deleted node
      edges: activeWorkflow.edges.filter(e => e.source !== nodeId && e.target !== nodeId)
    };
    onSaveWorkflow(updatedWorkflow);
  };

  const handleDeleteEdge = (edgeId: string) => {
    if (!activeWorkflow) return;
    const updatedWorkflow: Workflow = {
      ...activeWorkflow,
      edges: activeWorkflow.edges.filter(e => e.id !== edgeId)
    };
    onSaveWorkflow(updatedWorkflow);
  };

  return (
    <div className="space-y-8">
      {/* Selector & Template presets */}
      <div className="bg-white p-6 border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="w-full md:w-auto">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Active Pipeline Canvas</label>
          <select
            value={selectedWorkflowId}
            onChange={e => setSelectedWorkflowId(e.target.value)}
            className="w-full md:w-80 px-3.5 py-2.5 border border-gray-200 bg-[#F9FAFB] text-xs font-bold uppercase tracking-widest text-gray-700 outline-none focus:border-black transition"
          >
            {workflows.map(wf => (
              <option key={wf.id} value={wf.id}>{wf.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Combine className="w-3.5 h-3.5 text-gray-400" /> Presets:
          </span>
          <button
            onClick={() => handleTemplateLoad('support')}
            className="px-3 py-1.5 bg-[#F9FAFB] hover:bg-gray-100 text-gray-800 font-bold text-[10px] uppercase tracking-wider border border-gray-200 cursor-pointer transition-colors"
          >
            Enterprise Support Hub
          </button>
          <button
            onClick={() => handleTemplateLoad('seo')}
            className="px-3 py-1.5 bg-[#F9FAFB] hover:bg-gray-100 text-gray-800 font-bold text-[10px] uppercase tracking-wider border border-gray-200 cursor-pointer transition-colors"
          >
            SEO Copywriter Loop
          </button>
        </div>
      </div>

      {activeWorkflow ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Visual Workspace */}
          <div className="lg:col-span-3 bg-[#FCFDFD] border border-gray-200 p-8 relative min-h-[500px]">
            <div className="flex justify-between items-center pb-5 border-b border-gray-200 mb-8">
              <div className="flex items-center gap-3">
                <WorkflowIcon className="w-5 h-5 text-black" />
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-tight leading-tight">{activeWorkflow.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{activeWorkflow.description}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsAddingNode(true)}
                  className="px-4 py-2 bg-black hover:bg-gray-800 text-white font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5 cursor-pointer transition-colors duration-150"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Node Block
                </button>
                <button
                  onClick={() => onDeleteWorkflow(activeWorkflow.id)}
                  className="px-3 py-2 bg-white hover:bg-red-50 text-red-600 font-bold text-[10px] uppercase tracking-widest border border-gray-200 hover:border-red-200 cursor-pointer transition-colors duration-150"
                >
                  Delete Canvas
                </button>
              </div>
            </div>

            {/* Visual Steps representation with conditional forks */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeWorkflow.nodes.map(node => {
                  const correlatedAgent = agents.find(a => a.id === node.agentId);
                  
                  return (
                    <div 
                      key={node.id} 
                      className={`p-5 border relative bg-white transition-all hover:border-black ${
                        node.type === 'input' 
                          ? 'border-gray-200' 
                          : node.type === 'output'
                            ? 'border-gray-200'
                            : node.type === 'condition'
                              ? 'border-gray-200'
                              : 'border-gray-200'
                      }`}
                    >
                      <button
                        onClick={() => handleDeleteNode(node.id)}
                        className="absolute top-4 right-4 p-1 text-gray-400 hover:text-red-500 transition cursor-pointer"
                        title="Delete block"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center gap-2 mb-3">
                        {node.type === 'input' && <Compass className="w-4 h-4 text-gray-600" />}
                        {node.type === 'output' && <CheckCircle className="w-4 h-4 text-gray-600" />}
                        {node.type === 'condition' && <HelpIcon className="w-4 h-4 text-gray-600" />}
                        {node.type === 'agent' && <Bot className="w-4 h-4 text-gray-600" />}
                        
                        <span className="text-[9px] uppercase tracking-widest font-bold text-gray-400">
                          {node.type}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold uppercase tracking-tight text-gray-900 truncate">{node.label}</h4>
                      
                      {node.type === 'agent' && correlatedAgent && (
                        <div className="mt-3 text-xs text-gray-655 bg-[#F9FAFB] p-3 border border-gray-100 font-mono">
                          <span className="font-bold text-black uppercase tracking-tight text-[10px]">Processor:</span> {correlatedAgent.name} 
                          <span className="block text-[10px] mt-0.5 text-gray-400 font-semibold tracking-wide uppercase">Engine: {correlatedAgent.model}</span>
                        </div>
                      )}

                      {node.type === 'condition' && (
                        <div className="mt-3 text-xs text-gray-600 bg-[#F9FAFB] p-3 border border-gray-100 space-y-1.5 font-mono">
                          <div>
                            <span className="font-bold text-black uppercase text-[9px] tracking-wider block">Evaluates:</span> 
                            <code className="text-gray-700 bg-white border border-gray-100 px-1 py-0.5 text-[10px] block mt-0.5 mt-1">{node.config?.conditionExpression}</code>
                          </div>
                          <div>
                            <span className="font-bold text-black uppercase text-[9px] tracking-wider">Pass target:</span> <span className="text-gray-500 text-[10px]">#{node.config?.yesNodeId}</span>
                          </div>
                          <div>
                            <span className="font-bold text-black uppercase text-[9px] tracking-wider">Loop feedback:</span> <span className="text-gray-500 text-[10px]">#{node.config?.noNodeId}</span>
                          </div>
                        </div>
                      )}

                      <div className="mt-4 text-[9px] font-mono text-gray-400 uppercase tracking-widest">
                        Node ID: {node.id}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Edge Connections List */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Edges Router Connection Network</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeWorkflow.edges.map(edge => {
                    const srcNode = activeWorkflow.nodes.find(n => n.id === edge.source);
                    const tgtNode = activeWorkflow.nodes.find(n => n.id === edge.target);

                    return (
                      <div key={edge.id} className="p-3 bg-white border border-gray-200 text-xs text-gray-700 flex justify-between items-center hover:border-black transition-colors">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <span className="font-semibold truncate text-gray-800">{srcNode?.label || edge.source}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="font-semibold truncate text-gray-800">{tgtNode?.label || edge.target}</span>
                          
                          {edge.conditionLabel && (
                            <span className="px-2 py-0.2 bg-gray-100 text-gray-800 font-mono text-[9px] font-bold uppercase tracking-wider border border-gray-200 ml-1.5 shrink-0">
                              {edge.conditionLabel}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteEdge(edge.id)}
                          className="text-gray-400 hover:text-black p-1 transition cursor-pointer shrink-0"
                          title="Sever Connection"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Connection Controls & Block builder */}
          <div className="space-y-6">
            {/* Draw edge form */}
            <div className="bg-white p-6 border border-gray-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 mb-4 border-b border-gray-100 pb-3">Link Node Wires</h3>
              <form onSubmit={handleCreateConnection} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Source Block</label>
                  <select
                    value={sourceNodeId}
                    onChange={e => setSourceNodeId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 bg-[#F9FAFB] text-xs font-semibold outline-none focus:border-black transition"
                    required
                  >
                    <option value="">Choose Node...</option>
                    {activeWorkflow.nodes.map(n => (
                      <option key={n.id} value={n.id}>{n.label} ({n.id})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Target Block</label>
                  <select
                    value={targetNodeId}
                    onChange={e => setTargetNodeId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 bg-[#F9FAFB] text-xs font-semibold outline-none focus:border-black transition"
                    required
                  >
                    <option value="">Choose Node...</option>
                    {activeWorkflow.nodes.map(n => (
                      <option key={n.id} value={n.id}>{n.label} ({n.id})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Pass Routing Condition Case (Optional)</label>
                  <input
                    type="text"
                    value={edgeLabel}
                    onChange={e => setEdgeLabel(e.target.value)}
                    placeholder="e.g. Yes / Auditor Passed"
                    className="w-full px-3 py-2 border border-gray-200 text-xs font-semibold outline-none focus:border-black transition"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1 pb-1">
                  <input
                    type="checkbox"
                    id="isLoop"
                    checked={isFeedbackLoop}
                    onChange={e => setIsFeedbackLoop(e.target.checked)}
                    className="rounded-none border-gray-200 text-black focus:ring-black h-3.5 w-3.5"
                  />
                  <label htmlFor="isLoop" className="text-[10px] font-bold uppercase tracking-tight text-gray-500 select-none">Register as Collaborative loop</label>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-black hover:bg-gray-800 text-white text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-colors duration-150"
                >
                  Draw Logic Wire
                </button>
              </form>
            </div>

            {/* Diagnostic helper info */}
            <div className="bg-gray-50 p-6 border border-gray-150 text-xs text-gray-800 space-y-2">
              <h4 className="font-bold text-black uppercase tracking-wider text-[10px]">How Loops Work in Yuno:</h4>
              <p className="leading-relaxed text-gray-500 font-medium">When calling a <b>Condition Node</b>, it parses outcome values. If variables check out, it proceeds forward. If checkups fail, the engine routes instructions to the predecessor, correcting output state via iteration loops.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 bg-white border border-gray-200">
          <Combine className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-4">No active workflow templates designated.</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">Please select a preset template above to pre-populate an autonomous orchestration workflow.</p>
        </div>
      )}

      {/* Add Node modal */}
      {isAddingNode && activeWorkflow && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in animate-duration-150">
          <div className="bg-white border-2 border-black p-8 max-w-md w-full relative">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-900 mb-4 pb-2 border-b border-gray-100">Add Block to Pipeline</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Block Type</label>
                <select
                  value={nodeType}
                  onChange={e => setNodeType(e.target.value as any)}
                  className="w-full px-3 py-2.5 border border-gray-200 text-xs font-bold uppercase tracking-wide bg-white outline-none focus:border-black transition"
                >
                  <option value="agent">Autonomous AI Agent execution</option>
                  <option value="condition">Decision evaluation / Feedback router</option>
                  <option value="input">External User Input</option>
                  <option value="output">Final Published Resolution</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Node Title Label</label>
                <input
                  type="text"
                  value={nodeLabel}
                  onChange={e => setNodeLabel(e.target.value)}
                  placeholder="e.g. Meta Tag Auditor"
                  className="w-full px-3 py-2.5 border border-gray-200 text-xs font-semibold outline-none focus:border-black transition"
                  required
                />
              </div>

              {nodeType === 'agent' && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Assign Agent Profile</label>
                  <select
                    value={nodeAgentId}
                    onChange={e => setNodeAgentId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 text-xs font-bold uppercase bg-white outline-none focus:border-black transition"
                  >
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                    ))}
                  </select>
                </div>
              )}

              {nodeType === 'condition' && (
                <div className="space-y-3 p-4 bg-gray-50 border border-gray-150">
                  <div>
                    <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 font-sans">JS Evaluation Expression</label>
                    <input
                      type="text"
                      value={conditionExpr}
                      onChange={e => setConditionExpr(e.target.value)}
                      placeholder="e.g. compliant === true"
                      className="w-full px-3 py-2 border border-gray-250 text-xs font-mono bg-white outline-none focus:border-black transition"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 font-sans font-sans">Yes Target ID</label>
                      <input
                        type="text"
                        value={yesNode}
                        onChange={e => setYesNode(e.target.value)}
                        placeholder="publish"
                        className="w-full px-3 py-2 border border-gray-250 text-xs font-mono bg-white outline-none focus:border-black transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 font-sans">No Target ID</label>
                      <input
                        type="text"
                        value={noNode}
                        onChange={e => setNoNode(e.target.value)}
                        placeholder="support"
                        className="w-full px-3 py-2 border border-gray-250 text-xs font-mono bg-white outline-none focus:border-black transition"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 font-sans">Max allowed trace corrections loops</label>
                    <input
                      type="number"
                      value={loopLimit}
                      onChange={e => setLoopLimit(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-250 text-xs font-mono bg-white outline-none focus:border-black transition"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 pt-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddingNode(false)}
                className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-gray-600 bg-gray-50 hover:bg-gray-100 transition duration-150 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddNewNode}
                className="px-5 py-2.5 bg-black hover:bg-gray-800 text-white font-bold text-xs uppercase tracking-widest cursor-pointer transition duration-150 shadow"
              >
                Add Node
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
