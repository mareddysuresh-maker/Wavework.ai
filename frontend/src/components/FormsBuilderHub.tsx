import React, { useState } from 'react';
import { useFlow } from '../lib/FlowContext';
import { 
  ClipboardList, 
  Plus, 
  X, 
  Trash2, 
  Sparkles, 
  Link, 
  ClipboardCopy, 
  ClipboardCheck,
  FolderOpen
} from 'lucide-react';

export const FormsBuilderHub: React.FC = () => {
  const { 
    forms, 
    selectedList, 
    publishFormTemplate 
  } = useFlow();

  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  
  // Custom rows fields
  const [fields, setFields] = useState<any[]>([
    { id: 'f1', type: 'text', label: 'Feature / Bug Short Title', required: true },
    { id: 'f2', type: 'textarea', label: 'Description of core requirements', required: true }
  ]);

  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const handleAddField = () => {
    const id = `fld-${Date.now()}`;
    setFields([...fields, { id, type: 'text', label: 'Custom Input Label', required: false }]);
  };

  const handleRemoveField = (idx: number) => {
    setFields(fields.filter((_, i) => i !== idx));
  };

  const handleFieldChange = (idx: number, key: string, val: any) => {
    const copy = [...fields];
    copy[idx][key] = val;
    setFields(copy);
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !selectedList) return;

    await publishFormTemplate(formName, formDesc, fields);
    setFormName('');
    setFormDesc('');
    setFields([
      { id: 'f1', type: 'text', label: 'Feature / Bug Short Title', required: true },
      { id: 'f2', type: 'textarea', label: 'Description of core requirements', required: true }
    ]);
  };

  const copyFormLink = (slug: string) => {
    const fullLink = `${window.location.origin}/?publicFormSlug=${slug}`;
    navigator.clipboard.writeText(fullLink).then(() => {
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(null), 2000);
    }).catch(console.error);
  };

  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto h-full flex flex-col font-sans">
      
      {/* Upper header */}
      <div className="mb-8 border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inbound Portals Customizer</h1>
        <p className="text-xs text-slate-500 font-medium font-mono mt-0.5">
          ADMIN CUSTOMIZABLE FORMS BUILDERS | AUTOMATE CUSTOMERS SUBMISSIONS DIRECTLY INTO SPRINT LISTS TASK BOARD
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* Left builder panel */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3 mb-5 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span>Form Template Generator</span>
          </h3>

          {selectedList ? (
            <form onSubmit={handlePublish} className="space-y-6">
              <div className="p-3 bg-indigo-50 border border-indigo-150 rounded-lg text-indigo-800 text-xs font-semibold flex items-center gap-2">
                <FolderOpen className="w-4.5 h-4.5" />
                <span>Target Board List: "{selectedList.name}"</span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Form Portal Header Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Client Design Requests Form"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full border border-slate-250 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-indigo-500 text-slate-900 focus:bg-white bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Short Description Subtext</label>
                  <textarea
                    rows={2}
                    placeholder="Provide description on design requirements..."
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    className="w-full border border-slate-250 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-indigo-500 text-slate-900 focus:bg-white bg-slate-50"
                  />
                </div>
              </div>

              {/* Form Input Rows lists wrapper */}
              <div className="border-t border-slate-150 pt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Questions list ({fields.length})</span>
                  <button
                    type="button"
                    onClick={handleAddField}
                    className="text-xs bg-slate-100 hover:bg-slate-200 border border-slate-200 hover:text-slate-900 text-slate-600 font-bold px-3 py-1.5 rounded-lg cursor-pointer transition flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Row
                  </button>
                </div>

                <div className="space-y-3">
                  {fields.map((field, idx) => (
                    <div key={field.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex gap-3 items-center">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => handleFieldChange(idx, 'label', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-slate-800 font-bold focus:outline-none"
                        />
                        <div className="flex items-center gap-4 mt-2">
                          <select
                            value={field.type}
                            onChange={(e) => handleFieldChange(idx, 'type', e.target.value)}
                            className="bg-white border border-slate-200 text-[10px] font-semibold rounded p-1 focus:outline-none"
                          >
                            <option value="text">Text block</option>
                            <option value="textarea">Paragraph details</option>
                            <option value="dropdown">Choices dropdown</option>
                          </select>
                          <label className="flex items-center text-[10px] font-semibold gap-1">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => handleFieldChange(idx, 'required', e.target.checked)}
                              className="rounded border-slate-300 text-indigo-600"
                            />
                            Required
                          </label>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveField(idx)}
                        className="text-slate-400 hover:text-red-500 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-lg transition shadow-md shadow-indigo-501/20"
              >
                Publish public portal
              </button>
            </form>
          ) : (
            <div className="text-center py-10">
              <p className="text-xs text-slate-500 font-medium">Select a lists folder or space in side directory first before publishing customized intake forms.</p>
            </div>
          )}
        </div>

        {/* Right published portals list */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3 mb-5">
            Active Request Portals ({forms.length})
          </h3>

          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
            {forms.map(form => (
              <div key={form.id} className="border border-slate-200 rounded-xl p-4.5 bg-slate-50/50 space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 leading-tight block">{form.name}</h4>
                  <p className="text-xs text-slate-500 font-medium mt-0.5 leading-relaxed">{form.description}</p>
                </div>

                <div className="flex items-center justify-between border-t border-slate-150 pt-3 flex-wrap gap-2">
                  <span className="text-[10px] font-bold text-slate-400 font-mono">SLUG: {form.slug}</span>
                  
                  <button
                    onClick={() => copyFormLink(form.slug)}
                    className="text-[10.5px] font-bold bg-white hover:bg-slate-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                  >
                    {copiedSlug === form.slug ? <ClipboardCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Link className="w-3.5 h-3.5" />}
                    <span>{copiedSlug === form.slug ? 'Copied link!' : 'Copy Portal URL'}</span>
                  </button>
                </div>
              </div>
            ))}

            {forms.length === 0 && (
              <p className="text-center text-xs text-slate-400 italic py-6">No portal builders published yet.</p>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
export default FormsBuilderHub;
