import { useState, useEffect } from "react";
import { Save, FolderOpen, Trash2 } from "lucide-react";
import { SimulationConfig } from "../types";

interface Preset {
  name: string;
  config: Partial<SimulationConfig>;
}

interface PresetManagerProps {
  category: string;
  keysToSave: Array<keyof SimulationConfig>;
  currentConfig: SimulationConfig;
  onApply: (config: Partial<SimulationConfig>) => void;
  defaultPresets?: Preset[];
}

export default function PresetManager({ category, keysToSave, currentConfig, onApply, defaultPresets = [] }: PresetManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customPresets, setCustomPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState("");

  const storageKey = `typhoon_presets_${category}`;

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setCustomPresets(JSON.parse(saved));
      } catch (e) {}
    }
  }, [storageKey]);

  const handleSave = () => {
    if (!presetName.trim()) return;
    
    const subset: Partial<SimulationConfig> = {};
    keysToSave.forEach(k => {
      (subset as any)[k] = currentConfig[k];
    });

    const newPreset = { name: presetName.trim(), config: subset };
    const newPresets = [...customPresets, newPreset];
    setCustomPresets(newPresets);
    localStorage.setItem(storageKey, JSON.stringify(newPresets));
    setPresetName("");
  };

  const handleDelete = (index: number) => {
    const newPresets = customPresets.filter((_, i) => i !== index);
    setCustomPresets(newPresets);
    localStorage.setItem(storageKey, JSON.stringify(newPresets));
  };

  return (
    <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800/60 mb-4">
      <div 
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <FolderOpen className="w-3.5 h-3.5" />
          <span>全局预设管理 ({defaultPresets.length + customPresets.length})</span>
        </div>
        <div className="text-[10px] text-slate-500">{isOpen ? "收起 ▲" : "展开 ▼"}</div>
      </div>
      
      {isOpen && (
        <div className="mt-3 space-y-3">
          {defaultPresets.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[9px] text-slate-500 uppercase tracking-widest">内置预设</div>
              <div className="grid grid-cols-2 gap-2">
                {defaultPresets.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => onApply(p.config)}
                    className="p-1.5 text-[10px] text-left rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-[#1E9CFF] transition truncate text-slate-300"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="text-[9px] text-slate-500 uppercase tracking-widest">自定义预设</div>
            {customPresets.length === 0 ? (
              <div className="text-[10px] text-slate-600 italic">暂无自定义预设</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {customPresets.map((p, i) => (
                  <div key={i} className="flex rounded bg-slate-800 border border-slate-700 overflow-hidden">
                    <button
                      onClick={() => onApply(p.config)}
                      className="flex-1 p-1.5 text-[10px] text-left hover:bg-slate-700 hover:text-[#1E9CFF] transition truncate text-slate-300"
                    >
                      {p.name}
                    </button>
                    <button 
                      onClick={() => handleDelete(i)}
                      className="px-2 bg-slate-900/50 hover:bg-red-900/40 text-slate-500 hover:text-red-400 transition flex items-center justify-center"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex gap-2 pt-2 border-t border-slate-800">
            <input 
              type="text" 
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="预设名称..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-[#1E9CFF]"
            />
            <button 
              onClick={handleSave}
              disabled={!presetName.trim()}
              className="px-2.5 py-1 bg-[#1E9CFF] text-white rounded text-[10px] font-bold disabled:opacity-50 hover:bg-[#1E9CFF]/80 flex items-center gap-1 transition"
            >
              <Save className="w-3 h-3" /> 保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
