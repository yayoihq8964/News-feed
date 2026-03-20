import { useState, useEffect } from 'react'
import { getSettings, updateSettings, getProviders, testLlm } from '../services/api'
import type { AppSettings, ProviderInfo } from '../types'

interface Props { onClose: () => void }

export default function SettingsModal({ onClose }: Props) {
  const [settings, setSettings] = useState<Partial<AppSettings>>({})
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getSettings().then(s => setSettings(s)).catch(() => {})
    getProviders().then(p => setProviders(p.providers ?? [])).catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try { await updateSettings(settings); setTestResult('保存成功') }
    catch { setTestResult('保存失败') }
    setSaving(false)
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const r = await testLlm(
        (settings as Record<string, string>).default_llm_provider ?? 'openai',
        (settings as Record<string, string>).default_llm_model ?? '',
      )
      const ok = r.available ?? false
      setTestResult(ok ? `连接成功 ✓ ${r.status ?? ''}` : `失败: ${r.status ?? ''}`)
    } catch { setTestResult('连接失败') }
    setTesting(false)
  }

  const update = (k: string, v: string | number) => setSettings(s => ({ ...s, [k]: v }))

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto panel rounded-2xl border shadow-2xl p-6 m-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">设置</h2>
          <button onClick={onClose} className="text-muted hover:opacity-70 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-5">
          <section>
            <h3 className="text-sm font-semibold mb-3">LLM 模型设置</h3>
            <div className="space-y-3">
              <Field label="模型提供商">
                <select
                  value={(settings as Record<string, string>).default_llm_provider ?? 'openai'}
                  onChange={e => update('default_llm_provider', e.target.value)}
                  className="w-full text-sm rounded-xl border input-surface px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/30 appearance-none">
                  {providers.map(p => (
                    <option key={p.name} value={p.name}>{p.name}{p.configured ? ' ✓' : ''}</option>
                  ))}
                </select>
              </Field>
              <Field label="模型名称">
                <input
                  value={(settings as Record<string, string>).default_llm_model ?? ''}
                  onChange={e => update('default_llm_model', e.target.value)}
                  placeholder="gpt-4o"
                  className="w-full text-sm rounded-xl border input-surface px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </Field>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-3">轮询设置</h3>
            <Field label={`新闻拉取间隔: ${(settings as Record<string, number>).news_poll_interval ?? 60}秒 (重启后生效)`}>
              <input type="range" min="30" max="600" step="30"
                value={(settings as Record<string, number>).news_poll_interval ?? 60}
                onChange={e => update('news_poll_interval', parseInt(e.target.value))}
                className="w-full accent-indigo-500" />
            </Field>
          </section>

          <div className="flex items-center gap-3 pt-3 border-t timeline-border">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 text-sm font-medium py-2 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 transition-all shadow-sm hover:shadow">
              {saving ? '保存中...' : '保存设置'}
            </button>
            <button onClick={handleTest} disabled={testing}
              className="text-sm font-medium px-4 py-2 rounded-xl border panel text-muted hover-surface disabled:opacity-50 transition-all shadow-sm">
              {testing ? '测试中...' : '测试连接'}
            </button>
          </div>
          {testResult && (
            <p className={`text-xs text-center ${testResult.includes('成功') || testResult.includes('✓') ? 'text-teal-500' : 'text-rose-500'}`}>
              {testResult}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted mb-1 block">{label}</label>
      {children}
    </div>
  )
}
