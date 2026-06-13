import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Form } from '../types';
import { ClipboardList, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface PublicFormPageProps {
  slug: string;
  onClose?: () => void;
}

export const PublicFormPage: React.FC<PublicFormPageProps> = ({ slug, onClose }) => {
  const [form, setForm] = useState<Form | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    api.getPublicForm(slug)
      .then(res => {
        setForm(res);
        // Initialize blanks
        const initial: Record<string, any> = {};
        res.fields.forEach(f => {
          initial[f.id] = '';
        });
        setAnswers(initial);
      })
      .catch(err => {
        setError(err.message || 'Form portal disabled or outdated.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [slug]);

  const handleChange = (fieldId: string, val: string) => {
    setAnswers(prev => ({ ...prev, [fieldId]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    setIsSubmitLoading(true);
    try {
      const response = await api.submitPublicForm(slug, answers);
      if (response.success) {
        setIsSubmitted(true);
      }
    } catch (err: any) {
      setError(err.message || 'Submission failed');
    } finally {
      setIsSubmitLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center p-4 z-50 text-white">
        <div className="text-center font-sans">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium">Opening custom Client registration portal...</p>
        </div>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center p-4 z-50 text-white">
        <div className="max-w-md w-full bg-slate-950 border border-slate-800 rounded-2xl p-8 text-center font-sans space-y-4">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
          <h2 className="text-xl font-bold tracking-tight">Request Succeeded</h2>
          <p className="text-xs text-slate-400 font-medium leading-relaxed">
            Your file request has arrived safely in our ClickUp workspace backlog database. Our team has been alerted!
          </p>
          <div className="pt-4 border-t border-slate-900/40">
            {onClose ? (
              <button
                onClick={onClose}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-6 rounded-lg transition"
              >
                Return to Workspace
              </button>
            ) : (
              <p className="text-[10px] text-slate-500 font-mono uppercase">You can close this window now.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center p-4 z-50 text-white">
        <div className="max-w-sm w-full bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center font-sans space-y-3">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-rose-400">Connection Failed</h3>
          <p className="text-xs text-slate-400 font-semibold leading-normal">{error || 'Unknown portal anomaly.'}</p>
          {onClose && (
            <button
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs py-1.5 px-4 rounded-lg mt-2 cursor-pointer transition"
            >
              Return
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900 flex items-center justify-center p-4 z-50 text-white overflow-y-auto">
      
      <div className="max-w-lg w-full bg-slate-950 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6 font-sans">
        
        {/* Close Button if onClose exits */}
        {onClose && (
          <div className="flex justify-end -mt-4 -mr-4">
            <button
              onClick={onClose}
              className="p-1 px-3 bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-white rounded-lg cursor-pointer text-xs"
            >
              Close Intake Form
            </button>
          </div>
        )}

        {/* Form header details */}
        <div>
          <div className="flex items-center space-x-2 text-indigo-400 mb-2">
            <ClipboardList className="w-6 h-6" />
            <span className="font-bold tracking-widest text-[10px] uppercase font-mono">Public submission desk</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white mb-1 leading-snug">{form.name}</h2>
          <p className="text-slate-400 text-xs leading-relaxed font-semibold">{form.description}</p>
        </div>

        {/* Fields list form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {form.fields.map(field => (
            <div key={field.id} className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase">
                {field.label} {field.required && <span className="text-rose-500">*</span>}
              </label>

              {field.type === 'textarea' ? (
                <textarea
                  required={field.required}
                  rows={3}
                  value={answers[field.id] || ''}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  placeholder="Elaborate details here..."
                  className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-505 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none placeholder-slate-600 block leading-relaxed"
                />
              ) : field.type === 'dropdown' ? (
                <select
                  required={field.required}
                  value={answers[field.id] || ''}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-505 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none block cursor-pointer"
                >
                  <option value="">Select option...</option>
                  {(field.options || ['LOW', 'NORMAL', 'HIGH', 'URGENT']).map((opt, oIdx) => (
                    <option key={oIdx} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required={field.required}
                  value={answers[field.id] || ''}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  placeholder="Type answer..."
                  className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-505 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none placeholder-slate-600 block"
                />
              )}
            </div>
          ))}

          {/* Buttons trigger */}
          <div className="pt-4 border-t border-slate-900/40">
            <button
              type="submit"
              disabled={isSubmitLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/45 text-white font-bold text-xs py-3 rounded-lg transition shadow-lg shadow-indigo-500/20 cursor-pointer text-center"
            >
              {isSubmitLoading ? 'Saving Request securely...' : 'Submit Request Ticket'}
            </button>
          </div>
        </form>

      </div>

    </div>
  );
};
export default PublicFormPage;
