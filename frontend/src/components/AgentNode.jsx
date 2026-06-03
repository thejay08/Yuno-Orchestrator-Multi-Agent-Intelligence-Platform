import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Bot, Combine } from 'lucide-react';

export default function AgentNode({ data }) {
  const isInput = data.type === 'input';
  const isOutput = data.type === 'output';
  const isCondition = data.type === 'condition';

  return (
    <div className="bg-white border border-gray-200 p-5 shadow-sm hover:shadow hover:border-black transition-all rounded-none min-w-[200px] relative font-sans">
      
      {/* React Flow handles for visual linking */}
      {!isInput && (
        <Handle 
          type="target" 
          position={Position.Left} 
          style={{ background: '#000', borderRadius: 0, width: 8, height: 8 }} 
        />
      )}

      {/* Header element */}
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
        <Bot className="w-4 h-4 text-zinc-600 shrink-0" />
        <span className="text-[9px] uppercase tracking-widest font-bold text-gray-400">
          {data.type || 'agent_processor'}
        </span>
      </div>

      {/* Title element */}
      <div className="space-y-1">
        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-tight truncate">{data.label || 'Node Block'}</h4>
        <p className="text-[10px] text-gray-400 font-semibold truncate uppercase">{data.role || 'Processor State'}</p>
      </div>

      {/* Custom configuration attributes helper */}
      {isCondition && data.config && (
        <div className="mt-3 p-2 bg-gray-50 border border-gray-150 font-mono text-[9px] text-gray-500 overflow-hidden text-ellipsis">
          IF output satisfies: {data.config.conditionExpression}
        </div>
      )}

      {!isOutput && (
        <Handle 
          type="source" 
          position={Position.Right} 
          style={{ background: '#000', borderRadius: 0, width: 8, height: 8 }} 
        />
      )}
    </div>
  );
}
