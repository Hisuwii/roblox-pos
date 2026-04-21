import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { Upload, ImagePlus, Loader2, Trash2, Check, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

const S = {
  input: { background: '#0e0e1a', border: '1px solid #2e2e4a', color: '#e8e8f0', outline: 'none', borderRadius: '0.5rem', padding: '0.375rem 0.625rem', width: '100%', fontSize: '0.875rem' },
}

export default function InventoryImport({ onDone }) {
  const [open, setOpen] = useState(false)
  const [image, setImage] = useState(null)       // { dataUrl, mediaType }
  const [analyzing, setAnalyzing] = useState(false)
  const [results, setResults] = useState(null)   // [{name, qty, price}]
  const [adding, setAdding] = useState(false)
  const dropRef = useRef(null)

  // Paste handler — active whenever modal is open
  useEffect(() => {
    if (!open) return
    function onPaste(e) {
      const items = Array.from(e.clipboardData?.items ?? [])
      const imgItem = items.find((i) => i.type.startsWith('image/'))
      if (!imgItem) return
      const blob = imgItem.getAsFile()
      readFile(blob)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [open])

  function readFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => setImage({ dataUrl: e.target.result, mediaType: file.type || 'image/png' })
    reader.readAsDataURL(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith('image/')) readFile(file)
  }

  async function compressImage(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const MAX = 1024
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = dataUrl
    })
  }

  async function analyzeImage() {
    const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY
    if (!apiKey) return toast.error('Add VITE_OPENROUTER_API_KEY to your .env file')
    if (!image) return toast.error('Upload or paste a screenshot first')

    setAnalyzing(true)

    try {
      const compressed = await compressImage(image.dataUrl)

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-exp:free',
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: compressed } },
              {
                type: 'text',
                text: `This is a Roblox Blox Fruit inventory screenshot. Extract every fruit item visible.
For each item return:
- name: just the fruit name (e.g. "Dough", "Gas", "Venom") — no "Blox Fruit" prefix
- qty: the quantity number shown on the item card (usually bottom-left corner)

Respond ONLY with a valid JSON array, no explanation:
[{"name": "...", "qty": N}, ...]`,
              },
            ],
          }],
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error?.message ?? `API error ${res.status}`)
      }

      const data = await res.json()
      const text = data.choices?.[0]?.message?.content ?? ''

      const match = text.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('Could not parse response')
      const parsed = JSON.parse(match[0])

      setResults(parsed.map((item) => ({ name: item.name, qty: item.qty ?? 1, price: '' })))
      toast.success(`Found ${parsed.length} items`)
    } catch (err) {
      toast.error('Analysis failed: ' + err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  function updateResult(i, field, value) {
    setResults((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  function removeResult(i) {
    setResults((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function handleAdd() {
    const missing = results.filter((r) => r.price === '' || isNaN(parseFloat(r.price)))
    if (missing.length > 0) return toast.error(`Fill in prices for all ${missing.length} items`)

    setAdding(true)
    const payload = results.map((r) => ({
      name: r.name,
      qty: parseInt(r.qty) || 1,
      price: parseFloat(r.price),
      category: 'Blox Fruit',
    }))

    const { error } = await supabase.from('items').insert(payload)
    setAdding(false)

    if (error) return toast.error('Failed to add items: ' + error.message)
    toast.success(`Added ${payload.length} items to catalog!`)
    onDone?.()
    closeModal()
  }

  function closeModal() {
    setOpen(false)
    setImage(null)
    setResults(null)
    setAnalyzing(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white transition-colors"
        style={{ background: '#141422', border: '1px solid #24243c' }}
      >
        <ImagePlus size={15} /> Import Screenshot
      </button>

      {open && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" style={{ background: '#141422', border: '1px solid #24243c' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1c1c2e' }}>
              <div>
                <h3 className="text-white font-bold">Import from Screenshot</h3>
                <p className="text-slate-500 text-xs mt-0.5">Paste or upload your Blox Fruit inventory screen — AI reads names &amp; quantities automatically</p>
              </div>
              <button onClick={closeModal} className="text-slate-600 hover:text-slate-300 transition-colors"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-auto p-5 flex flex-col gap-5">
              {/* Drop / Paste Zone */}
              {!results && (
                <div>
                  <div
                    ref={dropRef}
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className="rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all relative overflow-hidden"
                    style={{ border: '2px dashed #2e2e4a', minHeight: '220px', background: '#0e0e1a' }}
                    onClick={() => document.getElementById('img-upload').click()}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#7c3aed')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2e2e4a')}
                  >
                    {image ? (
                      <img src={image.dataUrl} alt="preview" className="max-h-64 rounded-xl object-contain" />
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-slate-600 select-none p-6">
                        <Upload size={36} className="opacity-40" />
                        <div className="text-center">
                          <p className="text-slate-400 font-medium">Paste screenshot here</p>
                          <p className="text-sm mt-1">or click to upload / drag & drop</p>
                          <p className="text-xs mt-3 text-slate-700">Ctrl+V works too</p>
                        </div>
                      </div>
                    )}
                    <input id="img-upload" type="file" accept="image/*" className="hidden" onChange={(e) => readFile(e.target.files[0])} />
                  </div>

                  {image && (
                    <div className="flex gap-3 mt-3">
                      <button
                        onClick={() => setImage(null)}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white transition-colors"
                        style={{ background: '#1c1c2e' }}
                      >
                        Clear
                      </button>
                      <button
                        onClick={analyzeImage}
                        disabled={analyzing}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                        style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}
                      >
                        {analyzing ? (
                          <><Loader2 size={15} className="animate-spin" /> Analyzing...</>
                        ) : (
                          'Analyze Image'
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Results Table */}
              {results && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <p className="text-white font-semibold">
                      {results.length} items found
                      <span className="text-slate-500 text-sm font-normal ml-2">— fill in prices then add all</span>
                    </p>
                    <button onClick={() => { setResults(null); setImage(null) }} className="text-slate-600 hover:text-slate-300 text-sm transition-colors">← Re-scan</button>
                  </div>

                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1c1c2e' }}>
                    <div className="grid text-xs font-semibold uppercase tracking-wider px-4 py-2.5" style={{ gridTemplateColumns: '1fr 80px 120px 36px', background: '#0e0e1a', color: '#3d3d60', borderBottom: '1px solid #1c1c2e' }}>
                      <span>Fruit Name</span>
                      <span>Qty</span>
                      <span>Price (₱)</span>
                      <span />
                    </div>
                    <div className="flex flex-col" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                      {results.map((r, i) => (
                        <div
                          key={i}
                          className="grid items-center px-4 py-2.5 gap-2"
                          style={{ gridTemplateColumns: '1fr 80px 120px 36px', borderBottom: '1px solid #1c1c2e' }}
                        >
                          <span className="text-white text-sm font-medium truncate">{r.name}</span>
                          <input
                            type="number" min="1" max="4"
                            style={S.input}
                            value={r.qty}
                            onChange={(e) => updateResult(i, 'qty', e.target.value)}
                            onFocus={(e) => (e.target.style.borderColor = '#7c3aed')}
                            onBlur={(e) => (e.target.style.borderColor = '#2e2e4a')}
                          />
                          <input
                            type="number" min="0"
                            style={{ ...S.input, borderColor: r.price === '' ? '#4a1d1d' : '#2e2e4a' }}
                            placeholder="required"
                            value={r.price}
                            onChange={(e) => updateResult(i, 'price', e.target.value)}
                            onFocus={(e) => (e.target.style.borderColor = '#7c3aed')}
                            onBlur={(e) => (e.target.style.borderColor = r.price === '' ? '#4a1d1d' : '#2e2e4a')}
                          />
                          <button onClick={() => removeResult(i)} className="flex items-center justify-center text-slate-700 hover:text-red-400 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleAdd}
                    disabled={adding || results.length === 0}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}
                  >
                    {adding ? (
                      <><Loader2 size={15} className="animate-spin" /> Adding...</>
                    ) : (
                      <><Check size={15} /> Add {results.length} Items to Catalog</>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
